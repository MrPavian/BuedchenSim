import { Color, type DirectionalLight, type Fog, type HemisphereLight, type MeshLambertMaterial, type Object3D, type Scene } from 'three';
import type { Season } from '../../game/date';
import { environmentOf } from '../../game/environment';
import type { Game } from '../../game/game';
import type { WeatherCondition } from '../../game/weather';
import { createPrecipitation, type EffectsLevel, type PrecipitationKind } from './precipitation';

/**
 * Atmosphere of the outdoor scene (Auftrag 05): season and weather tint the lawn, sky, fog and light, wet paving gets
 * darker, snow covers the lawn, rain and snow fall around the player. A view only: it reads the game state (the derived
 * environment) and never changes it. Changes ease over a few seconds, so a new day or weather does not jump.
 */

export interface AtmosphereTargets {
  scene: Scene;
  fog: Fog;
  sun: DirectionalLight;
  hemisphere: HemisphereLight;
  /** Lawn and far ground: mixed towards season and snow colours. */
  vegetation: MeshLambertMaterial[];
  /** Sidewalk and street: darker when wet, lighter under snow. */
  paved: MeshLambertMaterial[];
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
  /** Brightness factor of the paving (wet < 1, snow > 1). */
  paved: number;
}

export interface AtmosphereInfo {
  season: Season;
  weather: WeatherCondition;
  temperature: number;
  precipitation: PrecipitationKind;
  particles: number;
  effects: EffectsLevel;
  target: AtmosphereLook;
}

export interface AtmosphereView {
  readonly root: Object3D;
  update(dt: number, focus: { x: number; z: number }): void;
  setEffects(level: EffectsLevel): void;
  /** Debug accessor: what the view shows and eases towards. */
  info(): AtmosphereInfo;
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
  paved: 1,
};

/** Season overrides of the base look (lawn tint, sun strength and colour, sky). */
export const SEASON_LOOK: Readonly<Record<Season, Partial<AtmosphereLook>>> = {
  spring: { vegetation: 0x86b867, vegetationMix: 0.25, sun: 3.1, sky: 0xd3e6ee },
  summer: {},
  autumn: { vegetation: 0x8f8a55, vegetationMix: 0.4, sun: 2.9, sunColor: 0xffdfb6, sky: 0xd6dde0 },
  winter: { vegetation: 0x9b9886, vegetationMix: 0.6, sun: 2.3, sunColor: 0xf3ecdf, sky: 0xd5dde3, hemisphere: 0.95 },
};

/** Weather overrides, applied after the season (sun = fair weather keeps the season look). */
export const WEATHER_LOOK: Readonly<Record<WeatherCondition, Partial<AtmosphereLook>>> = {
  sunny: {},
  cloudy: { sky: 0xc3cad0, sun: 1.6, sunColor: 0xeef0f2, hemisphere: 1.05, fogNear: 18, fogFar: 56 },
  'light-rain': { sky: 0xaab3bb, sun: 1.1, sunColor: 0xe4e8ec, hemisphere: 1.0, fogNear: 14, fogFar: 46, paved: 0.72 },
  'heavy-rain': { sky: 0x8f99a2, sun: 0.7, sunColor: 0xdde2e8, hemisphere: 0.9, fogNear: 9, fogFar: 34, paved: 0.6 },
  fog: { sky: 0xc9cdcf, sun: 0.9, sunColor: 0xf2f2ee, hemisphere: 1.05, fogNear: 4, fogFar: 22, paved: 0.9 },
  snow: { sky: 0xd9dee3, sun: 1.2, sunColor: 0xf4f6f8, hemisphere: 1.15, fogNear: 10, fogFar: 40, vegetation: 0xf3f6f8, vegetationMix: 0.9, paved: 1.18 },
  frost: { sky: 0xdde8f1, sun: 2.6, sunColor: 0xf6f3ea, hemisphere: 1.0, vegetation: 0xdfe6e3, vegetationMix: 0.55, paved: 1.05 },
};

export function lookFor(season: Season, weather: WeatherCondition = 'sunny'): AtmosphereLook {
  return { ...BASE_LOOK, ...SEASON_LOOK[season], ...WEATHER_LOOK[weather] };
}

export function precipitationFor(weather: WeatherCondition): PrecipitationKind {
  if (weather === 'light-rain') return 'rain';
  if (weather === 'heavy-rain') return 'heavy-rain';
  if (weather === 'snow') return 'snow';
  return 'none';
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
    paved: 1,
  };
  const goal = { sky: new Color(), sunColor: new Color(), vegetation: new Color() };
  const scratch = new Color();
  const inverse = new Color();
  const lawn = new Color(BASE_LOOK.vegetation);
  let target = BASE_LOOK;
  let season: Season = 'summer';
  let weather: WeatherCondition = 'sunny';
  let temperature = 0;
  let effects: EffectsLevel = 'full';
  let precipitation: PrecipitationKind = 'none';
  let first = true;
  const vegetationBase = t.vegetation.map((m) => m.color.clone());
  const pavedBase = t.paved.map((m) => m.color.clone());
  const background = t.scene.background instanceof Color ? t.scene.background : new Color();
  t.scene.background = background;
  const particles = createPrecipitation();

  const apply = (): void => {
    background.copy(current.sky);
    t.fog.color.copy(current.sky);
    t.fog.near = current.fogNear;
    t.fog.far = current.fogFar;
    t.sun.color.copy(current.sunColor);
    t.sun.intensity = current.sun;
    t.hemisphere.intensity = current.hemisphere;
    // Lawn textures are multiplied by the material colour: mixing towards the target colour (relative to the lawn's own
    // green) shifts them to dry, autumn or snowy tones.
    t.vegetation.forEach((m, i) => {
      const base = vegetationBase[i] ?? new Color(0xffffff);
      const shifted = scratch.copy(current.vegetation).multiply(inverse.set(1 / lawn.r, 1 / lawn.g, 1 / lawn.b));
      m.color.copy(base).lerp(shifted.multiply(base), current.vegetationMix);
    });
    t.paved.forEach((m, i) => {
      m.color.copy(pavedBase[i] ?? new Color(0xffffff)).multiplyScalar(current.paved);
    });
  };

  return {
    root: particles.root,
    update(dt, focus) {
      const env = environmentOf(game.content, game.state);
      season = env.season;
      weather = env.weather.condition;
      temperature = env.temperature;
      target = lookFor(season, weather);
      const kind = precipitationFor(weather);
      if (kind !== precipitation || first) {
        precipitation = kind;
        particles.set(kind, effects);
      }
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
      current.paved += (target.paved - current.paved) * k;
      apply();
      particles.update(Math.min(dt, 0.1), focus);
    },
    setEffects(level) {
      effects = level;
      particles.set(precipitation, effects);
    },
    info: () => ({ season, weather, temperature, precipitation, particles: particles.visibleCount(), effects, target: { ...target } }),
    dispose() {
      particles.dispose();
    },
  };
}
