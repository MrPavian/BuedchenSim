import { Raycaster, Vector3, type Camera, type Material, type Mesh } from 'three';
import type { Rect, Vec2 } from '../game/types';

/** Fade-able mesh with its own material instances (shared materials must not fade globally). */
interface FadeEntry {
  mesh: Mesh;
  materials: Material[];
  baseCastShadow: boolean;
  current: number;
  target: number;
  /** Hide the mesh completely (also removes its shadow) once nearly invisible. */
  hideWhenInvisible: boolean;
}

const RAY_HEIGHTS = [0.15, 0.9, 1.65];

export interface OcclusionOptions {
  /** Parts that may hide the player when the camera ray crosses them (walls, roof, sign, ...). */
  shell: Mesh[];
  /** Parts on the camera side (south wall, sign, door, shutter): faded while the player is inside. */
  front: Mesh[];
  roof: Mesh | null;
  footprint: Rect;
}

export interface Occlusion {
  update(dt: number, camera: Camera, player: Vec2, snap?: boolean): void;
  /** Sets all parts to fully visible at once. */
  reset(): void;
}

const OCCLUDED_OPACITY = 0.22;
const INSIDE_FRONT_OPACITY = 0.08;

export function createOcclusion(options: OcclusionOptions): Occlusion {
  const entries = new Map<Mesh, FadeEntry>();
  const register = (mesh: Mesh, hideWhenInvisible: boolean): void => {
    if (entries.has(mesh)) return;
    const source = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const own = source.map((m) => {
      const clone = m.clone();
      clone.transparent = true;
      return clone;
    });
    mesh.material = Array.isArray(mesh.material) ? own : (own[0] as Material);
    entries.set(mesh, {
      mesh,
      materials: own,
      baseCastShadow: mesh.castShadow,
      current: 1,
      target: 1,
      hideWhenInvisible,
    });
  };
  for (const mesh of options.shell) register(mesh, false);
  for (const mesh of options.front) register(mesh, false);
  if (options.roof) register(options.roof, true);

  const raycaster = new Raycaster();
  const origin = new Vector3();
  const goal = new Vector3();
  const direction = new Vector3();

  const apply = (entry: FadeEntry): void => {
    const solid = entry.current >= 0.999;
    for (const material of entry.materials) {
      material.opacity = entry.current;
      material.depthWrite = solid;
    }
    entry.mesh.castShadow = entry.baseCastShadow && entry.current > 0.5;
    entry.mesh.visible = !(entry.hideWhenInvisible && entry.current < 0.02);
  };

  const { footprint } = options;
  const occluders = [...options.shell, ...options.front];

  return {
    update(dt, camera, player, snap = false) {
      for (const entry of entries.values()) entry.target = 1;

      const inside =
        player.x > footprint.minX && player.x < footprint.maxX && player.z > footprint.minZ && player.z < footprint.maxZ;
      if (inside) {
        for (const mesh of options.front) {
          const e = entries.get(mesh);
          if (e) e.target = Math.min(e.target, INSIDE_FRONT_OPACITY);
        }
        if (options.roof) {
          const e = entries.get(options.roof);
          if (e) e.target = 0;
        }
      }

      // Anything the camera ray to the player crosses fades, so the figure never vanishes.
      camera.getWorldPosition(origin);
      for (const y of RAY_HEIGHTS) {
        goal.set(player.x, y, player.z);
        direction.subVectors(goal, origin);
        const distance = direction.length();
        direction.divideScalar(distance);
        raycaster.set(origin, direction);
        raycaster.far = Math.max(distance - 0.1, 0);
        for (const hit of raycaster.intersectObjects(occluders, false)) {
          const e = entries.get(hit.object as Mesh);
          if (e) e.target = Math.min(e.target, OCCLUDED_OPACITY);
        }
      }

      const k = snap ? 1 : 1 - Math.exp(-dt * 10);
      for (const entry of entries.values()) {
        entry.current += (entry.target - entry.current) * k;
        if (Math.abs(entry.target - entry.current) < 0.003) entry.current = entry.target;
        apply(entry);
      }
    },
    reset() {
      for (const entry of entries.values()) {
        entry.current = 1;
        entry.target = 1;
        apply(entry);
      }
    },
  };
}
