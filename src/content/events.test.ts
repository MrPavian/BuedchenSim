import { describe, expect, it } from 'vitest';
import { dateOfDay, dayOfDate } from '../game/date';
import { environmentOf } from '../game/environment';
import { eventStates, eventsOnDay, isEventDay, occurrenceOn } from '../game/eventCalendar';
import { createInitialState } from '../game/state';
import { weatherOfDay } from '../game/weather';
import { ruhrgebietClimate as climate } from './regions/ruhrgebiet/climate';
import { ruhrgebietEvents as events } from './regions/ruhrgebiet/events';
import { ruhrgebietPack } from './regions/ruhrgebiet';

const byId = (id: string) => events.find((e) => e.id === id)!;
const day = (year: number, month: number, dayOfMonth: number) => dayOfDate({ year, month, dayOfMonth });
const SEED = 3;

describe('neighbourhood events', () => {
  it('home games: every second Saturday from 12 June 2027, active 11:00-20:00', () => {
    const football = byId('event.fussballspieltag');
    const first = day(2027, 6, 12);
    expect(isEventDay(football, first, SEED, climate)).toBe(true);
    expect(isEventDay(football, first + 7, SEED, climate)).toBe(false);
    expect(isEventDay(football, first + 14, SEED, climate)).toBe(true);
    expect(isEventDay(football, first + 1, SEED, climate)).toBe(false);
    const at = (minute: number) => eventStates([football], first, minute, SEED, climate)[0]?.status;
    expect([at(600), at(660), at(1199), at(1200)]).toEqual(['announced', 'active', 'active', 'completed']);
    expect(eventStates([football], first - 3, 600, SEED, climate)[0]?.status).toBe('announced');
    expect(eventStates([football], first - 10, 600, SEED, climate)[0]?.status).toBe('planned'); // more than 7 days ahead
    expect(eventStates([football], first + 1, 600, SEED, climate)[0]?.status).toBe('completed');
    expect(eventStates([football], first + 2, 600, SEED, climate)[0]?.status).toBe('planned'); // next game in 12 days
    expect(eventStates([football], first + 8, 600, SEED, climate)[0]?.status).toBe('announced'); // next game in 6 days
  });

  it('street fest (2nd weekend of August, two days), flea market (1st Sunday Apr-Oct), Christmas time (1-24 Dec)', () => {
    const fest = occurrenceOn(byId('event.strassenfest'), day(2027, 8, 14), SEED, climate);
    expect(fest).toMatchObject({ startDay: day(2027, 8, 14), endDay: day(2027, 8, 15) });
    expect(dateOfDay(fest!.startDay).weekday).toBe(5);
    const flea = byId('event.flohmarkt');
    expect(isEventDay(flea, day(2027, 7, 4), SEED, climate)).toBe(true);
    expect(isEventDay(flea, day(2027, 7, 11), SEED, climate)).toBe(false);
    expect(isEventDay(flea, day(2027, 12, 5), SEED, climate)).toBe(false); // not in winter
    const xmas = occurrenceOn(byId('event.weihnachtszeit'), day(2027, 12, 10), SEED, climate);
    expect(xmas).toMatchObject({ startDay: day(2027, 12, 1), endDay: day(2027, 12, 24) });
    expect(isEventDay(byId('event.weihnachtszeit'), day(2027, 12, 25), SEED, climate)).toBe(false);
  });

  it('heat wave: only runs of at least three days >= 30 °C, one occurrence per run, announced at most two days ahead', () => {
    const heat = byId('event.hitzewelle');
    let found = 0;
    for (let d = 1; d < 800; d++) {
      const occ = occurrenceOn(heat, d, SEED, climate);
      if (!occ) continue;
      found++;
      expect(occ.endDay - occ.startDay + 1).toBeGreaterThanOrEqual(3);
      for (let x = occ.startDay; x <= occ.endDay; x++) {
        expect(weatherOfDay(SEED, climate, x).high).toBeGreaterThanOrEqual(30);
        expect(occurrenceOn(heat, x, SEED, climate)).toEqual(occ); // the same occurrence on every day: no double start
      }
      expect(eventsOnDay([heat], occ.startDay, occ.startDay - 3, SEED, climate)).toHaveLength(0);
      expect(eventsOnDay([heat], occ.startDay, occ.startDay - 2, SEED, climate)).toHaveLength(1);
      d = occ.endDay;
    }
    expect(found).toBeGreaterThan(0);
  });

  it("the environment lists today's events and the ones active right now; effects end with the event", () => {
    const state = createInitialState(ruhrgebietPack, SEED);
    state.calendar.day = day(2027, 6, 12);
    state.calendar.minute = 700;
    expect(environmentOf(ruhrgebietPack, state).activeEvents).toContain('event.fussballspieltag');
    state.calendar.minute = 1250;
    const after = environmentOf(ruhrgebietPack, state);
    expect(after.eventsToday).toContain('event.fussballspieltag');
    expect(after.activeEvents).not.toContain('event.fussballspieltag');
    state.calendar.day += 1;
    expect(environmentOf(ruhrgebietPack, state).eventsToday).not.toContain('event.fussballspieltag');
  });
});
