// Proof of concept, NOT part of the game. The ThreeRT side: our kiosk scene (exported from the running game as GLB by
// export-scene.mjs) with lights in physical units, a physical sky, and – for test 5 – a glass sphere, a mirror and an
// emissive panel. Bundled with ThreeRT's own bundler (run-threert.mjs), so `@threert/*` resolve from the ThreeRT checkout.
import { defineGame, type FrameContext } from "@threert/gameplay";
import {
  BoxGeometry,
  DirectionalLight,
  GLTFModel,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SkyAtmosphere,
  SphereGeometry,
} from "@threert/scene";

type V3 = [number, number, number];

export interface KioskOptions {
  /** GLB path relative to the asset root given to the renderer (`--assets`). */
  glb: string;
  camera: { position: V3; target: V3; fov: number };
  /** Sun below the horizon: only the kiosk's own lamps and emissive surfaces light the scene. */
  night?: boolean;
  /** Glass sphere, mirror and emissive panel beside the kiosk (test 5). */
  extras?: boolean;
  /** Camera orbits around its target (test 6, frame script). */
  orbit?: boolean;
  /** Manual exposure for the night view (EV100). */
  ev100?: number;
  name: string;
}

/** The game's sun direction (world.ts: DirectionalLight at (-9, 17, 11) towards the origin) as elevation / azimuth. */
const SUN = { elevation: 50.0, azimuth: -39.3 };

export function buildKiosk(o: KioskOptions) {
  const scene = new Scene();
  const sun = new DirectionalLight(0xfff1dc, o.night ? 0.05 : 90000); // lux (clear midday ~ 100 000)
  sun.name = "sun";
  sun.setSunAngles(o.night ? -12 : SUN.elevation, SUN.azimuth);
  scene.add(sun);
  scene.environment = new SkyAtmosphere({ sun });

  const kiosk = new GLTFModel(o.glb);
  kiosk.name = "kiosk";
  scene.add(kiosk);

  // The game's three point lights, in candela instead of three.js' arbitrary intensities (the emissive lamp glass in
  // the GLB also emits light by itself).
  const lamp = (name: string, color: number, cd: number, p: V3, radius: number) => {
    const l = new PointLight(color, cd);
    l.name = name;
    l.position.set(...p);
    l.radius = radius;
    scene.add(l);
  };
  const k = o.night ? 0.4 : 1;
  lamp("interior", 0xffc27a, 180 * k, [0, 2.2, 0], 0.15);
  lamp("door", 0xffd9a0, 40 * k, [0.95, 2.2, 2.2], 0.05);
  lamp("awning", 0xffd9a0, 80 * k, [-1, 2.34, 2.44], 0.1);

  if (o.extras) {
    // Test 5 on the pavement east of the kiosk (inside the outside view).
    const glass = new Mesh(new SphereGeometry(0.45, 64, 32), new MeshPhysicalMaterial({ name: "poc-glass", color: 0xffffff, transmission: 1, roughness: 0.0, ior: 1.5 }));
    glass.position.set(4.2, 0.6, 2.4);
    scene.add(glass);
    const mirror = new Mesh(new BoxGeometry(1.4, 1.8, 0.04), new MeshStandardMaterial({ name: "poc-mirror", color: 0xffffff, metalness: 1, roughness: 0.02 }));
    mirror.position.set(5.6, 1.05, 1.2);
    mirror.rotation.y = -0.6;
    scene.add(mirror);
    const panel = new Mesh(new BoxGeometry(1.2, 0.4, 0.06), new MeshStandardMaterial({ name: "poc-neon", color: 0x000000, emissive: 0x30ff9a, emissiveIntensity: o.night ? 60 : 3000 }));
    panel.position.set(3.4, 1.4, 1.0);
    scene.add(panel);
  }

  const camera = new PerspectiveCamera(o.camera.fov, 16 / 9, 0.05, 300);
  camera.name = "camera";
  camera.position.set(...o.camera.position);
  camera.lookAt(...o.camera.target);
  // Manual exposure (EV100) like a photographer: auto exposure brightened the night view until every lamp flooded.
  if (o.night) camera.setManualExposure(o.ev100 ?? 4);
  else camera.setAutoExposure(0);
  scene.add(camera);
  return { scene, camera, options: { name: o.name } };
}

export function kioskGame(o: KioskOptions) {
  const [px, py, pz] = o.camera.position;
  const [tx, ty, tz] = o.camera.target;
  const radius = Math.hypot(px - tx, pz - tz);
  const start = Math.atan2(px - tx, pz - tz);
  return defineGame({
    state: {},
    setup: () => buildKiosk(o),
    handlers: {},
    // Test 6: a slow orbit (0.35 rad/s) around the view's target at the game camera's height and distance.
    frame: o.orbit
      ? (f: FrameContext<Record<string, never>>) => {
          const a = start + f.time * 0.35;
          f.camera.position.set(tx + Math.sin(a) * radius, py, tz + Math.cos(a) * radius);
          f.camera.lookAt(tx, ty, tz);
        }
      : undefined,
  });
}
