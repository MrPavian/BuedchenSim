import {
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  PlaneGeometry,
  PointLight,
  Scene,
  type BufferGeometry,
  type Object3D,
  type Material,
  type Texture,
} from 'three';
import type { Game } from '../game/game';
import type { Vec2 } from '../game/types';
import { quarterTurnToRadians, placementBaseHeight } from '../game/placement';
import { PLAYER_RADIUS } from '../game/constants';
import { createFurniture, createGround, createKiosk } from './assets/registry';
import { createFollowCamera } from './camera';
import { moveCircle, resolvePosition } from './collision';
import { createInput } from './input';
import { buildWorldColliders } from './colliders';
import { createMaterials, palette } from './materials';
import { createOcclusion } from './occlusion';
import { createPlayerFigure } from './playerFigure';
import { createRenderer } from './renderer';
import { createKioskView } from './views/kioskView';
import { createMarkerView } from './views/markerView';

export { WebGLUnavailableError } from './renderer';

export interface World {
  /** Fixed simulation step (input, movement, collision). */
  update(dt: number): void;
  /** Draws a frame; alpha is the fraction of a fixed step left over, used to interpolate the player. */
  render(alpha: number): void;
  resize(): void;
  dispose(): void;
  /** Debug accessor: pose of a placement read from the actual scene object (null for unknown ids). */
  getPlacementTransform(id: string): { x: number; y: number; z: number; rotationDeg: number } | null;
}

const PLAYER_SPEED = 3.5; // m/s
const PLAYER_FOOT_Y = 0.02;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function createWorld(game: Game, container: HTMLElement): World {
  const layout = game.content.layout;
  const renderer = createRenderer(container);
  const materials = createMaterials();

  const scene = new Scene();
  scene.background = new Color(palette.sky);
  scene.fog = new Fog(palette.sky, 20, 62);

  // --- Lighting: soft sky/ground fill, one warm sun with shadows, warm lamp inside the kiosk.
  scene.add(new HemisphereLight(0xdcebf5, 0x8c7f68, 1.15));
  scene.add(new AmbientLight(0xffffff, 0.15));
  const sun = new DirectionalLight(0xffe7bf, 2.5);
  sun.position.set(-9, 17, 11);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const extent = 18;
  Object.assign(sun.shadow.camera, { left: -extent, right: extent, top: extent, bottom: -extent, near: 1, far: 60 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  const fp = layout.kiosk.footprint;
  const lamp = new PointLight(0xffc27a, 14, 8, 2);
  lamp.position.set((fp.minX + fp.maxX) / 2, layout.kiosk.height - 0.5, (fp.minZ + fp.maxZ) / 2);
  scene.add(lamp);

  // --- Ground (far plane hides the void beyond the layout areas), kiosk, furniture.
  const base = new Mesh(new PlaneGeometry(400, 400), materials.base);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -0.03;
  base.receiveShadow = true;
  scene.add(base);
  for (const area of layout.ground) scene.add(createGround(area, materials));
  const kioskRoot = createKiosk(layout.kiosk, materials);
  scene.add(kioskRoot);
  const placementObjects = new Map<string, Object3D>();
  for (const placement of layout.placements) {
    const asset = game.content.assets[placement.assetId];
    if (!asset) throw new Error(`Placement "${placement.id}" references unknown asset "${placement.assetId}"`);
    const object = createFurniture(asset, materials);
    object.name = placement.id;
    object.position.set(
      placement.position.x,
      placementBaseHeight(placement, layout, game.content.assets),
      placement.position.z,
    );
    object.rotation.y = quarterTurnToRadians(placement.rotation);
    if (placement.scale !== undefined) object.scale.setScalar(placement.scale);
    scene.add(object);
    placementObjects.set(placement.id, object);
  }

  const kioskView = createKioskView(game, kioskRoot);
  const occlusion = createOcclusion({ ...kioskView.parts, footprint: fp });
  const markers = createMarkerView(game, layout.interactionPoints, materials);
  scene.add(markers.root);

  const figure = createPlayerFigure(materials);
  scene.add(figure.root);

  const { closed: closedColliders, open: openColliders } = buildWorldColliders(layout, game.content.assets);

  const followCamera = createFollowCamera(1);
  const input = createInput(() => {
    game.interact();
  });

  // --- Player pose: fixed-step simulation state plus interpolated render pose.
  let prev: Vec2 = { ...game.state.player.position };
  let cur: Vec2 = { ...game.state.player.position };
  let heading = game.state.player.heading;
  let visualHeading = heading;
  let speed = 0;
  let needsSnap = true;

  const readPoseFromState = (): void => {
    prev = { ...game.state.player.position };
    cur = { ...prev };
    heading = game.state.player.heading;
    visualHeading = heading;
    speed = 0;
    needsSnap = true;
  };
  const offReplaced = game.signals.on('game.state.replaced', readPoseFromState);

  const resize = (): void => {
    const width = Math.max(container.clientWidth || window.innerWidth, 1);
    const height = Math.max(container.clientHeight || window.innerHeight, 1);
    renderer.setSize(width, height, false);
    followCamera.setAspect(width / height);
  };
  window.addEventListener('resize', resize);
  resize();

  let lastFrameMs: number | null = null;
  let elapsed = 0;

  return {
    update(dt) {
      const colliders = game.state.kiosk.doorOpen ? openColliders : closedColliders;
      const axis = input.axis();
      prev = cur;
      let next: Vec2;
      if (axis.x !== 0 || axis.z !== 0) {
        next = moveCircle(cur, { x: axis.x * PLAYER_SPEED * dt, z: axis.z * PLAYER_SPEED * dt }, PLAYER_RADIUS, colliders, layout.walkBounds);
        heading = Math.atan2(axis.x, axis.z);
      } else {
        // Idle: still resolve overlaps (e.g. the door was closed while standing in the doorway).
        next = resolvePosition(cur, PLAYER_RADIUS, colliders, layout.walkBounds);
      }
      speed = Math.hypot(next.x - cur.x, next.z - cur.z) / dt;
      if (next.x !== cur.x || next.z !== cur.z || heading !== game.state.player.heading) {
        game.player.setPose(next, heading);
      }
      cur = next;
    },

    render(alpha) {
      const now = performance.now();
      const dt = lastFrameMs === null ? 0 : Math.min((now - lastFrameMs) / 1000, 0.1);
      lastFrameMs = now;
      elapsed += dt;

      const pose: Vec2 = { x: lerp(prev.x, cur.x, alpha), z: lerp(prev.z, cur.z, alpha) };
      figure.root.position.set(pose.x, PLAYER_FOOT_Y, pose.z);
      visualHeading += wrapAngle(heading - visualHeading) * (needsSnap ? 1 : 1 - Math.exp(-dt * 14));
      figure.root.rotation.y = visualHeading;
      figure.animate(dt, speed);

      if (needsSnap) followCamera.snapTo(pose);
      else followCamera.update(dt, pose);

      kioskView.update(needsSnap ? 1e3 : dt);
      markers.update(elapsed);
      scene.updateMatrixWorld(true);
      occlusion.update(dt, followCamera.camera, pose, needsSnap);
      needsSnap = false;

      renderer.render(scene, followCamera.camera);
    },

    resize,

    getPlacementTransform(id) {
      const object = placementObjects.get(id);
      if (!object) return null;
      scene.updateMatrixWorld(true);
      return {
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
        rotationDeg: Math.round(((object.rotation.y * 180) / Math.PI + 360) % 360),
      };
    },

    dispose() {
      window.removeEventListener('resize', resize);
      offReplaced();
      input.dispose();
      kioskView.dispose();
      markers.dispose();
      const geometries = new Set<BufferGeometry>();
      const mats = new Set<Material>();
      scene.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        geometries.add(mesh.geometry);
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) mats.add(m);
      });
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => {
        for (const value of Object.values(m)) {
          if (value && (value as Texture).isTexture) (value as Texture).dispose();
        }
        m.dispose();
      });
      materials.textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
