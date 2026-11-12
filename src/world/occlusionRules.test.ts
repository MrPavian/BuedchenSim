import { describe, expect, it } from 'vitest';
import { kioskCutHeight } from '../game/kioskGeometry';
import { testPack } from '../game/testing/fixture-pack';
import { decideCut, isInsideKiosk, segmentHitsBox, shouldShowSilhouette } from './occlusionRules';

const { kiosk } = testPack.layout;
const cut = kioskCutHeight(kiosk);
/** Camera as the follow camera places it: 9 m up, 10 m south of the (lagging) focus. */
const cameraFor = (x: number, z: number) => ({ x, y: 10.2, z: z + 10 });

describe('segmentHitsBox', () => {
  const box = { minX: 0, maxX: 1, minY: 0, maxY: 1, minZ: 0, maxZ: 1 };
  it('detects crossings, misses and segments that stop short', () => {
    expect(segmentHitsBox({ x: -1, y: 0.5, z: 0.5 }, { x: 2, y: 0.5, z: 0.5 }, box)).toBe(true);
    expect(segmentHitsBox({ x: -1, y: 2, z: 0.5 }, { x: 2, y: 2, z: 0.5 }, box)).toBe(false);
    expect(segmentHitsBox({ x: -1, y: 0.5, z: 0.5 }, { x: -0.2, y: 0.5, z: 0.5 }, box)).toBe(false);
  });
});

describe('decideCut', () => {
  it('cuts nothing while the player is outside (building stays solid)', () => {
    for (const p of [{ x: 2, z: 2.6 }, { x: 0, z: -2.6 }, { x: -3.6, z: 0 }, { x: 3.6, z: 0 }, { x: -2.5, z: -3.5 }]) {
      expect(isInsideKiosk(p, kiosk.footprint)).toBe(false);
      const d = decideCut(kiosk, cut, p, cameraFor(p.x, p.z));
      expect(d.roof).toBe(false);
      expect(Object.values(d.walls).some(Boolean)).toBe(false);
    }
  });

  it('hides the roof and cuts the south wall for every inside position; north never', () => {
    for (const p of [{ x: -1, z: 0.8 }, { x: -2, z: 0.6 }, { x: 2, z: 0.9 }, { x: 0.6, z: -0.9 }]) {
      const d = decideCut(kiosk, cut, p, cameraFor(p.x, p.z));
      expect(d.roof).toBe(true);
      expect(d.walls.south).toBe(true);
      expect(d.walls.north).toBe(false);
    }
  });

  it('cuts only the side wall the camera line crosses', () => {
    // Camera lagging far east of a player standing near the east wall: the east wall is in the way.
    const p = { x: 2.7, z: 0 };
    expect(decideCut(kiosk, cut, p, { x: 6, y: 10, z: 10 }).walls.east).toBe(true);
    expect(decideCut(kiosk, cut, p, { x: 6, y: 10, z: 10 }).walls.west).toBe(false);
    // Centred camera: neither side wall is crossed.
    const centred = decideCut(kiosk, cut, { x: 0, z: 0 }, cameraFor(0, 0));
    expect(centred.walls.east || centred.walls.west).toBe(false);
  });
});

describe('shouldShowSilhouette', () => {
  const show = (x: number, z: number, was = false) => shouldShowSilhouette(kiosk, cameraFor(x, z), { x, z }, was);
  it('shows it behind the kiosk and where the building is between camera and figure', () => {
    expect(show(0, -3.0)).toBe(true);
    expect(show(0, -4.2)).toBe(true);
    expect(show(-2.5, -3.2)).toBe(true);
  });
  it('does not show it inside, beside the crates, or in front', () => {
    expect(show(0.6, -0.3)).toBe(false);
    expect(show(-1, 0.8)).toBe(false);
    expect(show(-3.45, -0.1)).toBe(false);
    expect(show(-3.5, 0.6)).toBe(false);
    expect(show(2, 2.9)).toBe(false);
  });
  it('keeps a shown silhouette slightly longer (hysteresis)', () => {
    // Camera lagging east: the line to a figure just west of the building grazes the corner region.
    const cam = { x: 0, y: 10.2, z: 10 };
    const fig = { x: -3.1, z: -0.5 };
    const off = shouldShowSilhouette(kiosk, cam, fig, false);
    const on = shouldShowSilhouette(kiosk, cam, fig, true);
    expect(on || !off).toBe(true);
    expect(off && !on).toBe(false);
  });
});
