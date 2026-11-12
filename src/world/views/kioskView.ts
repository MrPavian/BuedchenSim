import type { Object3D } from 'three';
import type { Game } from '../../game/game';
import { getKioskParts, type KioskParts } from '../assets/kiosk';

const ANIMATION_RATE = 7; // 1/s exponential approach

export interface KioskView {
  /** Animates towards the state; call every rendered frame. */
  update(dt: number): void;
  /** Jumps to the current state without animation. */
  snap(): void;
  dispose(): void;
  /** Named parts of the kiosk (cut groups, roof, ...) for the occlusion. */
  parts: KioskParts;
}

/** Door and sales-window flap visuals driven by `game.state.kiosk`; resyncs on `game.state.replaced`. */
export function createKioskView(game: Game, kioskRoot: Object3D): KioskView {
  const parts = getKioskParts(kioskRoot);
  let doorTarget = 0;
  let shutterTarget = 0;
  let doorAmount = 0;
  let shutterAmount = 0;

  const readState = (): void => {
    doorTarget = game.state.kiosk.doorOpen ? 1 : 0;
    shutterTarget = game.state.kiosk.shutterOpen ? 1 : 0;
  };
  const apply = (): void => {
    parts.animated['door']?.setOpen(doorAmount);
    parts.animated['flap']?.setOpen(shutterAmount);
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
