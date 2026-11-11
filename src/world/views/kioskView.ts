import type { Mesh, Object3D } from 'three';
import type { Game } from '../../game/game';
import { KIOSK_NAMES } from '../assets/kioskK001';

const DOOR_OPEN_ANGLE = -Math.PI / 2; // swings inward (see rig frame in kioskK001)
const SHUTTER_OPEN_ANGLE = -Math.PI * 0.47; // flap folds up and outward like an awning
const ANIMATION_RATE = 7; // 1/s exponential approach

export interface KioskView {
  /** Animates towards the state; call every rendered frame. */
  update(dt: number): void;
  /** Jumps to the current state without animation. */
  snap(): void;
  dispose(): void;
  parts: { shell: Mesh[]; front: Mesh[]; roof: Mesh | null };
}

function meshes(root: Object3D, predicate: (name: string) => boolean): Mesh[] {
  const out: Mesh[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh && predicate(o.name)) out.push(o as Mesh);
  });
  return out;
}

/** Door and sales-window flap visuals driven by `game.state.kiosk`; resyncs on `game.state.replaced`. */
export function createKioskView(game: Game, kioskRoot: Object3D): KioskView {
  const door = kioskRoot.getObjectByName(KIOSK_NAMES.door);
  const flap = kioskRoot.getObjectByName(KIOSK_NAMES.shutter);
  let doorTarget = 0;
  let shutterTarget = 0;
  let doorAmount = 0;
  let shutterAmount = 0;

  const readState = (): void => {
    doorTarget = game.state.kiosk.doorOpen ? 1 : 0;
    shutterTarget = game.state.kiosk.shutterOpen ? 1 : 0;
  };
  const apply = (): void => {
    if (door) door.rotation.y = DOOR_OPEN_ANGLE * doorAmount;
    if (flap) flap.rotation.x = SHUTTER_OPEN_ANGLE * shutterAmount;
  };
  const snap = (): void => {
    readState();
    doorAmount = doorTarget;
    shutterAmount = shutterTarget;
    apply();
  };
  snap();

  const offs = [
    game.signals.on('kiosk.door.changed', ({ open }) => {
      doorTarget = open ? 1 : 0;
    }),
    game.signals.on('kiosk.shutter.changed', ({ open }) => {
      shutterTarget = open ? 1 : 0;
    }),
    game.signals.on('game.state.replaced', snap),
  ];

  const isWall = (n: string): boolean => n.startsWith(KIOSK_NAMES.wallPrefix);
  const roof = meshes(kioskRoot, (n) => n === KIOSK_NAMES.roof)[0] ?? null;
  const parts = {
    shell: meshes(kioskRoot, (n) => isWall(n) || n === KIOSK_NAMES.sign),
    front: [
      ...meshes(kioskRoot, (n) => n.startsWith(`${KIOSK_NAMES.wallPrefix}south.`) || n === KIOSK_NAMES.sign),
    ],
    roof,
  };
  if (roof) parts.shell.push(roof);
  // Door leaf and flap are children of animated groups; collect their meshes explicitly.
  for (const group of [door, flap]) {
    if (!group) continue;
    group.traverse((o) => {
      if ((o as Mesh).isMesh) {
        parts.shell.push(o as Mesh);
        parts.front.push(o as Mesh);
      }
    });
  }

  return {
    parts,
    snap,
    update(dt) {
      const k = 1 - Math.exp(-ANIMATION_RATE * dt);
      doorAmount += (doorTarget - doorAmount) * k;
      shutterAmount += (shutterTarget - shutterAmount) * k;
      if (Math.abs(doorTarget - doorAmount) < 0.001) doorAmount = doorTarget;
      if (Math.abs(shutterTarget - shutterAmount) < 0.001) shutterAmount = shutterTarget;
      apply();
    },
    dispose() {
      for (const off of offs) off();
    },
  };
}
