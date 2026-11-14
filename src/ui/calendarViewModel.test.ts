import { describe, expect, it } from 'vitest';
import { createGame } from '../game/game';
import { testPack } from '../game/testing/fixture-pack';
import { buildCalendarView, hudDateText } from './calendarViewModel';

describe('calendar view model', () => {
  it('shows the date and season and the next seven days, without changing the state', () => {
    const game = createGame(testPack);
    const before = JSON.stringify(game.state);
    const view = buildCalendarView(game);
    expect(view.todayLabel).toBe('Montag, 7. Juni 2027');
    expect(view.seasonLabel).toBe('Sommer');
    expect(view.days.map((d) => d.label)).toEqual(['Mo 7.6.', 'Di 8.6.', 'Mi 9.6.', 'Do 10.6.', 'Fr 11.6.', 'Sa 12.6.', 'So 13.6.']);
    expect(hudDateText(1)).toBe('7. Juni 2027 · Sommer');
    expect(hudDateText(1 + 365)).toBe('6. Juni 2028 · Sommer');
    expect(JSON.stringify(game.state)).toBe(before);
  });
});
