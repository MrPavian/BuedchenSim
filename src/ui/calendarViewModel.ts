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
}

export interface CalendarView {
  /** "Montag, 7. Juni 2027" */
  todayLabel: string;
  /** "Sommer" */
  seasonLabel: string;
  season: Season;
  /** Today and the following six days. */
  days: CalendarDayView[];
}

/** Short HUD text: "7. Juni 2027 · Sommer". */
export function hudDateText(day: number): string {
  const d = dateOfDay(day);
  return `${texts.date(d.dayOfMonth, d.month, d.year)} · ${texts.seasonNames[d.season]}`;
}

function longLabel(day: number): string {
  const d = dateOfDay(day);
  return `${texts.weekdayLong[d.weekday]}, ${texts.date(d.dayOfMonth, d.month, d.year)}`;
}

/** Pure: reads the state, changes nothing (opening the panel never changes the game). */
export function buildCalendarView(game: Pick<Game, 'state' | 'content'>): CalendarView {
  const today = game.state.calendar.day;
  const d = dateOfDay(today);
  const days: CalendarDayView[] = [];
  for (let i = 0; i < 7; i += 1) {
    const day = today + i;
    const di = dateOfDay(day);
    days.push({
      day,
      isToday: i === 0,
      label: texts.calendar.dayLabel(texts.weekdayShort[di.weekday], texts.dateShort(di.dayOfMonth, di.month)),
      longLabel: longLabel(day),
      season: di.season,
    });
  }
  return { todayLabel: longLabel(today), seasonLabel: texts.seasonNames[d.season], season: d.season, days };
}
