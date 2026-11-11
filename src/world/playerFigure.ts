import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Group, Mesh, SphereGeometry, type Material } from 'three';
import type { Materials } from './materials';

export interface PlayerFigure {
  /** Pivot at the feet; faces +Z at rotation 0. */
  root: Group;
  /** Advances the walk cycle; `speed` in m/s. */
  animate(dt: number, speed: number): void;
}

function mesh(geometry: ConstructorParameters<typeof Mesh>[0], material: Material): Mesh {
  const m = new Mesh(geometry, material);
  m.castShadow = true;
  return m;
}

/** Stylised ~1.75 m figure: blue jacket, orange cap with a clear brim and nose pointing forward (+Z). */
export function createPlayerFigure(m: Materials): PlayerFigure {
  const root = new Group();
  root.name = 'player';

  const body = new Group();
  root.add(body);

  const torso = mesh(new CapsuleGeometry(0.25, 0.3, 4, 12), m.playerJacket);
  torso.position.y = 1.1;
  body.add(torso);

  const head = mesh(new SphereGeometry(0.2, 16, 12), m.playerSkin);
  head.position.y = 1.56;
  body.add(head);

  const capDome = mesh(new SphereGeometry(0.215, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.playerCap);
  capDome.position.y = 1.58;
  body.add(capDome);
  const brim = mesh(new BoxGeometry(0.26, 0.03, 0.24), m.playerCap);
  brim.position.set(0, 1.6, 0.24);
  body.add(brim);
  const nose = mesh(new SphereGeometry(0.045, 8, 8), m.playerSkin);
  nose.position.set(0, 1.53, 0.2);
  body.add(nose);

  const limb = (geometry: CylinderGeometry, material: Material, x: number, y: number): Group => {
    const pivot = new Group();
    pivot.position.set(x, y, 0);
    const part = mesh(geometry, material);
    part.position.y = -geometry.parameters.height / 2;
    pivot.add(part);
    return pivot;
  };
  const legGeometry = new CylinderGeometry(0.09, 0.08, 0.8, 8);
  const armGeometry = new CylinderGeometry(0.065, 0.06, 0.62, 8);
  const legL = limb(legGeometry, m.playerPants, -0.12, 0.8);
  const legR = limb(legGeometry, m.playerPants, 0.12, 0.8);
  const armL = limb(armGeometry, m.playerJacket, -0.32, 1.38);
  const armR = limb(armGeometry, m.playerJacket, 0.32, 1.38);
  body.add(legL, legR, armL, armR);
  for (const x of [-0.12, 0.12]) {
    const shoe = mesh(new BoxGeometry(0.15, 0.08, 0.26), m.playerShoe);
    shoe.position.set(x, 0.04, 0.04);
    body.add(shoe);
  }

  let phase = 0;
  return {
    root,
    animate(dt, speed) {
      const moving = speed > 0.1;
      if (moving) phase += dt * 9;
      const swing = moving ? Math.sin(phase) * 0.55 : 0;
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing;
      armR.rotation.x = swing;
      body.position.y = moving ? Math.abs(Math.sin(phase)) * 0.03 : 0;
    },
  };
}
