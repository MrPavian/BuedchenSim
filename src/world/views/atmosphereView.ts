import { Color, type DirectionalLight, type Fog, type HemisphereLight, type MeshLambertMaterial, type Scene } from 'three';
import { dateOfDay, type Season } from '../../game/date';
import type { Game } from '../../game/game';

/**
 * Atmosphere of the outdoor scene (Auftrag 05): season and weather tint the lawn, sky, fog and light. A view only: it
 * reads the game state and never changes it. Changes ease over a few seconds, so a new day or weather does not jump.
 */

export interface AtmosphereTargets {
  scene: Scene;
  fog: Fog;
  sun: DirectionalLight;
  hemisphere: HemisphereLight;
  /** Lawn and far ground: tinted by the season (their textures/colours are multiplied). */
  vegetation: MeshLambertMaterial[];
}

export interface AtmosphereLook {
  sky: number;
  fogNear: number;
  fogFar: number;
  sunColor: number;
  sun: number;
  hemisphere: number;
  /** Colour the lawn and far ground are mixed towards (dry, autumn, snow), and how much (0..1). */
  vegetation: number;
  vegetationMix: number;
}

export interface AtmosphereView {
  update(dt: number): void;
  /** Debug accessor: the look the view is easing towards and the season it shows. */
  info(): { season: Season; target: AtmosphereLook };
  dispose(): void;
}

/** Base look (summer, fair weather): the Auftrag 04.5 light rig. */
export const BASE_LOOK: AtmosphereLook = {
  sky: 0xcfe2ec,
  fogNear: 20,
  fogFar: 62,
  sunColor: 0xffe2b4,
  sun: 3.3,
  hemisphere: 0.85,
  vegetation: 0x7d935f,
  vegetationMix: 0,
};

/** Season overrides of the base look (lawn tint, sun strength and colour, sky). */
export const SEASON_LOOK: Readonly<Record<Season, Partial<AtmosphereLook>>> = {
  spring: { vegetation: 0x86b867, vegetationMix: 0.25, sun: 3.1, sky: 0xd3e6ee },
  summer: {},
  autumn: { vegetation: 0x8f8a55, vegetationMix: 0.4, sun: 2.9, sunColor: 0xffdfb6, sky: 0xd6dde0 },
  winter: { vegetation: 0x9b9886, vegetationMix: 0.6, sun: 2.3, sunColor: 0xf3ecdf, sky: 0xd5dde3, hemisphere: 0.95 },
};

export function lookFor(season: Season): AtmosphereLook {
  return { ...BASE_LOOK, ...SEASON_LOOK[season] };
}

export function createAtmosphereView(game: Game, t: AtmosphereTargets): AtmosphereView {
  const current = {
    sky: new Color(BASE_LOOK.sky),
    sunColor: new Color(BASE_LOOK.sunColor),
    vegetation: new Color(BASE_LOOK.vegetation),
    vegetationMix: 0,
    fogNear: BASE_LOOK.fogNear,
    fogFar: BASE_LOOK.fogFar,
    sun: BASE_LOOK.sun,
    hemisphere: BASE_LOOK.hemisphere,
  };
  const goal = { sky: new Color(), sunColor: new Color(), vegetation: new Color() };
  const scratch = new Color();
  const inverse = new Color();
  let target = BASE_LOOK;
  let season: Season = 'summer';
  let first = true;
  const vegetationBase = t.vegetation.map((m) => m.color.clone());
  const background = t.scene.background instanceof Color ? t.scene.background : new Color();
  t.scene.background = background;

  const apply = (): void => {
    background.copy(current.sky);
    t.fog.color.copy(current.sky);
    t.fog.near = current.fogNear;
    t.fog.far = current.fogFar;
    t.sun.color.copy(current.sunColor);
    t.sun.intensity = current.sun;
    t.hemisphere.intensity = current.hemisphere;
    // Lawn textures are multiplied by the material colour: white keeps the texture; mixing towards the target colour
    // (relative to the lawn's own green) shifts it to dry, autumn or snowy tones.
    const lawn = new Color(BASE_LOOK.vegetation);
    t.vegetation.forEach((m, i) => {
      const base = vegetationBase[i] ?? new Color(0xffffff);
      const shifted = scratch.copy(current.vegetation).multiply(inverse.set(1 / lawn.r, 1 / lawn.g, 1 / lawn.b));
      m.color.copy(base).lerp(shifted.multiply(base), current.vegetationMix);
    });
  };

  return {
    update(dt) {
      season = dateOfDay(game.state.calendar.day).season;
      target = lookFor(season);
      goal.sky.setHex(target.sky);
      goal.sunColor.setHex(target.sunColor);
      goal.vegetation.setHex(target.vegetation);
      const k = first ? 1 : 1 - Math.exp(-dt * 1.5);
      first = false;
      current.sky.lerp(goal.sky, k);
      current.sunColor.lerp(goal.sunColor, k);
      current.vegetation.lerp(goal.vegetation, k);
      current.vegetationMix += (target.vegetationMix - current.vegetationMix) * k;
      current.fogNear += (target.fogNear - current.fogNear) * k;
      current.fogFar += (target.fogFar - current.fogFar) * k;
      current.sun += (target.sun - current.sun) * k;
      current.hemisphere += (target.hemisphere - current.hemisphere) * k;
      apply();
    },
    info: () => ({ season, target: { ...target } }),
    dispose() {
      // Nothing owned: the scene, lights and materials belong to the world.
    },
  };
}
