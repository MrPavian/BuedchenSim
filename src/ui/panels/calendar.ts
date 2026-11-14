import { buildCalendarView } from '../calendarViewModel';
import { el, testId } from '../dom';
import type { Panel, PanelContext } from '../modal';
import { texts } from '../texts';

/** Calendar, weather forecast and events (Auftrag 05). Read-only: rendering never changes the game state. */
export function createCalendarPanel(ctx: PanelContext): Panel {
  const { game } = ctx;
  return {
    id: 'calendar',
    title: () => texts.calendar.title,
    reset() {},
    render(body) {
      const view = buildCalendarView(game);
      const head = testId(el('div', 'ui-calendar-today'), 'calendar-today');
      head.append(el('strong', undefined, view.todayLabel), el('span', 'ui-calendar-season', view.seasonLabel));
      head.dataset['season'] = view.season;
      body.append(head);

      body.append(el('h3', 'ui-subtitle', texts.calendar.nextDays));
      const list = testId(el('div', 'ui-calendar-days'), 'calendar-days');
      for (const d of view.days) {
        const row = testId(el('div', 'ui-calendar-day'), `calendar-day-${d.day}`);
        if (d.isToday) row.dataset['today'] = 'true';
        const label = el('span', 'ui-calendar-day-label', d.isToday ? `${texts.calendar.today} · ${d.label}` : d.label);
        label.title = d.longLabel;
        row.append(label, el('span', 'ui-muted ui-small', texts.calendar.noEvents));
        list.append(row);
      }
      body.append(list);
    },
  };
}
