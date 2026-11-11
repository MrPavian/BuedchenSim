import { PerspectiveCamera, Vector3 } from 'three';
import type { Vec2 } from '../game/types';

/** Third person, oblique and elevated from the south; fixed orientation, exponential follow. */
const OFFSET = new Vector3(0, 9, 10);
const LOOK_HEIGHT = 1.2;
const FOLLOW_RATE = 5; // 1/s; frame-rate independent via 1 - exp(-rate * dt)

export interface FollowCamera {
  camera: PerspectiveCamera;
  setAspect(aspect: number): void;
  snapTo(target: Vec2): void;
  update(dt: number, target: Vec2): void;
}

export function createFollowCamera(aspect: number): FollowCamera {
  const camera = new PerspectiveCamera(42, aspect, 0.5, 200);
  const focus = new Vector3();

  const place = (): void => {
    camera.position.copy(focus).add(OFFSET);
    camera.lookAt(focus);
  };

  return {
    camera,
    setAspect(next) {
      camera.aspect = next;
      camera.updateProjectionMatrix();
    },
    snapTo(target) {
      focus.set(target.x, LOOK_HEIGHT, target.z);
      place();
    },
    update(dt, target) {
      const k = 1 - Math.exp(-FOLLOW_RATE * dt);
      focus.x += (target.x - focus.x) * k;
      focus.z += (target.z - focus.z) * k;
      focus.y = LOOK_HEIGHT;
      place();
    },
  };
}
