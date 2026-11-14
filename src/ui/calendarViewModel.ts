import { dateOfDay, type Season } from '../game/date';
import type { Game } from '../game/game';
import { texts } from './texts';

/** One day row of the calendar panel. */
export interface CalendarDayView {
  day: number;
  isToday: boolean;
  /** "Mo 7.6." */
  label: string;
  /** "Montag, 7. Juni 2027" */
  longLabel: string;
  season: Season;
  weather: {
    symbol: string;
    /** "Sonnig" for the exact days, "eher nass" for the tendency days. */
    text: string;
    range: string;
    /** "sicher" or "Tendenz, 75 % sicher". */
    reliability: string;
    sure: boolean;
  };
}

export interface CalendarView {
  /** "Montag, 7. Juni 2027" */
  todayLabel: string;
  /** "Sommer" */
  seasonLabel: string;
  season: Season;
  /** Today and the following six days. */
  days: CalendarDayView[];
  /** "☂ Leichter Regen · 14 °C (10–19 °C)" */
  weatherNow: string;
}

/** Short HUD text: "7. Juni 2027 · Sommer". */
export function hudDateText(day: number): string {
  const d = dateOfDay(day);
  return `${texts.date(d.dayOfMonth, d.month, d.year)} · ${texts.seasonNames[d.season]}`;
}

/** HUD weather: "☀ 24 °C". */
export function hudWeatherText(game: Pick<Game, 'weather'>): string {
  const env = game.weather.environment();
  return `${texts.weather.symbols[env.weather.condition]} ${texts.weather.now(env.temperature)}`;
}

function longLabel(day: number): string {
  const d = dateOfDay(day);
  return `${texts.weekdayLong[d.weekday]}, ${texts.date(d.dayOfMonth, d.month, d.year)}`;
}

/** Pure: reads the state, changes nothing (opening the panel never changes the game). */
export function buildCalendarView(game: Pick<Game, 'state' | 'content' | 'weather'>): CalendarView {
  const today = game.state.calendar.day;
  const d = dateOfDay(today);
  const days: CalendarDayView[] = [];
  const forecast = game.weather.forecast();
  for (let i = 0; i < 7; i += 1) {
    const day = today + i;
    const di = dateOfDay(day);
    const f = forecast[i];
    const sure = f !== undefined && f.condition !== null;
    days.push({
      weather: f
        ? {
            symbol: f.condition ? texts.weather.symbols[f.condition] : texts.weather.tendencySymbols[f.tendency],
            text: f.condition ? texts.weather.conditions[f.condition] : texts.weather.tendencies[f.tendency],
            range: texts.weather.range(f.low, f.high),
            reliability: sure ? texts.calendar.sure : texts.calendar.tendency(f.confidence),
            sure,
          }
        : { symbol: '', text: '', range: '', reliability: '', sure: false },
      day,
      isToday: i === 0,
      label: texts.calendar.dayLabel(texts.weekdayShort[di.weekday], texts.dateShort(di.dayOfMonth, di.month)),
      longLabel: longLabel(day),
      season: di.season,
    });
  }
  const env = game.weather.environment();
  const weatherNow = `${texts.weather.symbols[env.weather.condition]} ${texts.weather.conditions[env.weather.condition]} · ${texts.weather.now(env.temperature)} (${texts.weather.range(env.weather.low, env.weather.high)})`;
  return { todayLabel: longLabel(today), seasonLabel: texts.seasonNames[d.season], season: d.season, days, weatherNow };
}
