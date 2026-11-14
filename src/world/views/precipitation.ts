import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  type Object3D,
} from 'three';

/**
 * Rain and snow particles around the camera focus (Auftrag 05, 6.3). One draw call each, a fixed upper bound of
 * particles, no allocations per frame. Pure decoration: it reads nothing from the game.
 */

export type PrecipitationKind = 'none' | 'rain' | 'heavy-rain' | 'snow';
/** User setting: full particles, a quarter of them, or none (lighting and wet ground stay). */
export type EffectsLevel = 'full' | 'reduced' | 'off';

export const MAX_RAIN_DROPS = 1600;
export const MAX_SNOW_FLAKES = 1200;
const AREA = 26; // metres around the focus
const TOP = 14;

export interface Precipitation {
  readonly root: Object3D;
  set(kind: PrecipitationKind, level: EffectsLevel): void;
  update(dt: number, focus: { x: number; z: number }): void;
  /** Debug: particles currently drawn. */
  visibleCount(): number;
  dispose(): void;
}

/** Small deterministic generator (so the pattern is the same on every start). */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createPrecipitation(): Precipitation {
  const rnd = lcg(42);
  // Rain: short vertical line segments (2 vertices each).
  const rainPos = new Float32Array(MAX_RAIN_DROPS * 6);
  const rainSpeed = new Float32Array(MAX_RAIN_DROPS);
  for (let i = 0; i < MAX_RAIN_DROPS; i += 1) {
    const x = (rnd() - 0.5) * AREA;
    const z = (rnd() - 0.5) * AREA;
    const y = rnd() * TOP;
    rainPos.set([x, y, z, x + 0.02, y + 0.45, z + 0.02], i * 6);
    rainSpeed[i] = 9 + rnd() * 4;
  }
  const rainGeo = new BufferGeometry();
  rainGeo.setAttribute('position', new BufferAttribute(rainPos, 3));
  const rainMat = new LineBasicMaterial({ color: new Color(0xb9c6d2), transparent: true, opacity: 0.45, depthWrite: false });
  const rain = new LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.name = 'weather.rain';

  // Snow: points drifting down with a little sway.
  const snowPos = new Float32Array(MAX_SNOW_FLAKES * 3);
  const snowPhase = new Float32Array(MAX_SNOW_FLAKES);
  for (let i = 0; i < MAX_SNOW_FLAKES; i += 1) {
    snowPos.set([(rnd() - 0.5) * AREA, rnd() * TOP, (rnd() - 0.5) * AREA], i * 3);
    snowPhase[i] = rnd() * Math.PI * 2;
  }
  const snowGeo = new BufferGeometry();
  snowGeo.setAttribute('position', new BufferAttribute(snowPos, 3));
  // Round soft flakes: a small radial-gradient sprite instead of square points.
  const flake = document.createElement('canvas');
  flake.width = flake.height = 32;
  const g2 = flake.getContext('2d');
  if (g2) {
    const grad = g2.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad;
    g2.fillRect(0, 0, 32, 32);
  }
  const flakeTexture = new CanvasTexture(flake);
  const snowMat = new PointsMaterial({ color: 0xffffff, size: 0.07, map: flakeTexture, transparent: true, opacity: 0.95, depthWrite: false });
  const snow = new Points(snowGeo, snowMat);
  snow.frustumCulled = false;
  snow.name = 'weather.snow';

  let kind: PrecipitationKind = 'none';
  let count = 0;
  let time = 0;
  rain.visible = false;
  snow.visible = false;

  const group = new Group();
  group.name = 'weather';
  group.add(rain, snow);

  return {
    root: group,
    set(next, level) {
      kind = next;
      const share = level === 'off' ? 0 : level === 'reduced' ? 0.25 : 1;
      rain.visible = (kind === 'rain' || kind === 'heavy-rain') && share > 0;
      snow.visible = kind === 'snow' && share > 0;
      if (rain.visible) {
        count = Math.floor(MAX_RAIN_DROPS * share * (kind === 'heavy-rain' ? 1 : 0.45));
        rainGeo.setDrawRange(0, count * 2);
        rainMat.opacity = kind === 'heavy-rain' ? 0.55 : 0.4;
      } else if (snow.visible) {
        count = Math.floor(MAX_SNOW_FLAKES * share);
        snowGeo.setDrawRange(0, count);
      } else {
        count = 0;
      }
    },
    update(dt, focus) {
      time += dt;
      if (rain.visible) {
        rain.position.set(focus.x, 0, focus.z);
        for (let i = 0; i < count; i += 1) {
          const o = i * 6;
          let y = (rainPos[o + 1] as number) - (rainSpeed[i] as number) * dt;
          if (y < 0) y += TOP;
          rainPos[o + 1] = y;
          rainPos[o + 4] = y + 0.45;
        }
        (rainGeo.getAttribute('position') as BufferAttribute).needsUpdate = true;
      }
      if (snow.visible) {
        snow.position.set(focus.x, 0, focus.z);
        for (let i = 0; i < count; i += 1) {
          const o = i * 3;
          let y = (snowPos[o + 1] as number) - 0.9 * dt;
          if (y < 0) y += TOP;
          snowPos[o + 1] = y;
          snowPos[o] = (snowPos[o] as number) + Math.sin(time * 0.8 + (snowPhase[i] as number)) * 0.25 * dt;
        }
        (snowGeo.getAttribute('position') as BufferAttribute).needsUpdate = true;
      }
    },
    visibleCount: () => (rain.visible || snow.visible ? count : 0),
    dispose() {
      rainGeo.dispose();
      rainMat.dispose();
      snowGeo.dispose();
      snowMat.dispose();
      flakeTexture.dispose();
    },
  };
}
