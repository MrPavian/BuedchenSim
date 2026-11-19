import { dateOfDay, type GameDate } from './date';

/**
 * Sun position and daylight for a game day and minute (Auftrag 06, 6.3). Pure and derived: nothing is saved. The game
 * clock shows local time in the Ruhr area (about 51.5 deg N, 7.2 deg E) with the central European summer time rule, so
 * in June the sun sets after 21:30 and in December before 16:30. Precision: a few minutes, which is plenty for light.
 */

export const LATITUDE_DEG = 51.5;
export const LONGITUDE_DEG = 7.2;

/** Elevation (deg) at which the day is fully dark, and at which full daylight begins. Civil twilight ends at -6 deg. */
const NIGHT_DEG = -6;
const DAY_DEG = 6;

export interface SunState {
  /** Height above the horizon in degrees (negative: below). */
  elevationDeg: number;
  /** Compass direction of the sun in degrees from south, positive towards west (morning negative, evening positive). */
  azimuthDeg: number;
  /** Unit vector from the ground towards the sun in world coordinates (+X east, +Y up, +Z south). */
  direction: { x: number; y: number; z: number };
  /** 0 = night, 1 = full day; smooth through dawn and dusk. */
  daylight: number;
  /** True while summer time applies to the clock. */
  summerTime: boolean;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
const deg = (r: number): number => (r * 180) / Math.PI;

/** Last Sunday of a month (EU summer time switches on the last Sundays of March and October). */
function lastSunday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0));
  return last.getUTCDate() - last.getUTCDay();
}

/** Summer time from the last Sunday in March to the last Sunday in October (whole days; the switch hour is ignored). */
export function isSummerTime(date: GameDate): boolean {
  const { year, month, dayOfMonth } = date;
  if (month < 3 || month > 10) return false;
  if (month > 3 && month < 10) return true;
  if (month === 3) return dayOfMonth >= lastSunday(year, 3);
  return dayOfMonth < lastSunday(year, 10);
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Sun state for a game day (1-based counter) and minute of the day (0..1439, clock time). */
export function sunOf(day: number, minute: number): SunState {
  const date = dateOfDay(day);
  const n = date.dayOfYear;
  const summerTime = isSummerTime(date);
  // Fractional year (rad), declination and equation of time (NOAA approximation).
  const g = ((2 * Math.PI) / (date.leapYear ? 366 : 365)) * (n - 1 + (minute / 60 - 12) / 24);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  // Clock time -> true solar time (minutes): CET is UTC+1, CEST UTC+2.
  const utcOffsetMin = (summerTime ? 2 : 1) * 60;
  const solarMin = minute - utcOffsetMin + 4 * LONGITUDE_DEG + eqTime;
  const hourAngle = rad(solarMin / 4 - 180);
  const lat = rad(LATITUDE_DEG);
  const sinEl = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)));
  // Azimuth from south, positive towards west.
  const az = Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat));
  const cosEl = Math.cos(el);
  return {
    elevationDeg: deg(el),
    azimuthDeg: deg(az),
    direction: { x: -Math.sin(az) * cosEl, y: Math.sin(el), z: Math.cos(az) * cosEl },
    daylight: smoothstep(NIGHT_DEG, DAY_DEG, deg(el)),
    summerTime,
  };
}

/** Minute of the day (clock time) at which the sun crosses the horizon, searched by the minute; null if it does not. */
export function sunCrossing(day: number, kind: 'rise' | 'set'): number | null {
  let prev = sunOf(day, 0).elevationDeg;
  for (let m = 1; m < 1440; m += 1) {
    const e = sunOf(day, m).elevationDeg;
    if (kind === 'rise' && prev < -0.833 && e >= -0.833) return m;
    if (kind === 'set' && prev >= -0.833 && e < -0.833) return m;
    prev = e;
  }
  return null;
}
