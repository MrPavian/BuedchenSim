import { buildCalendarView } from '../calendarViewModel';
import { button, el, testId } from '../dom';
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
      const now = testId(el('p', 'ui-calendar-now'), 'calendar-weather-now');
      now.append(el('span', 'ui-muted', `${texts.calendar.weatherNow}: `), el('strong', undefined, view.weatherNow));
      body.append(now);

      body.append(el('h3', 'ui-subtitle', `${texts.calendar.nextDays} · ${texts.calendar.forecast}`));
      const list = testId(el('div', 'ui-calendar-days'), 'calendar-days');
      for (const d of view.days) {
        const row = testId(el('div', 'ui-calendar-day'), `calendar-day-${d.day}`);
        if (d.isToday) row.dataset['today'] = 'true';
        const label = el('span', 'ui-calendar-day-label', d.isToday ? `${texts.calendar.today} · ${d.label}` : d.label);
        label.title = d.longLabel;
        const weather = testId(el('span', 'ui-calendar-weather'), `calendar-weather-${d.day}`);
        weather.dataset['sure'] = String(d.weather.sure);
        weather.append(
          el('span', 'ui-calendar-symbol', d.weather.symbol),
          el('span', undefined, d.weather.text),
          el('span', 'ui-calendar-range', d.weather.range),
          el('span', 'ui-muted ui-small', d.weather.reliability),
        );
        row.append(label, weather, el('span', 'ui-muted ui-small', texts.calendar.noEvents));
        list.append(row);
      }
      body.append(list);

      // Device setting: weather particles (never changes the simulation).
      const settings = testId(el('div', 'ui-calendar-settings'), 'calendar-effects');
      settings.append(el('span', undefined, texts.calendar.effects));
      for (const level of ['full', 'reduced', 'off'] as const) {
        const b = button(texts.calendar.effectsLevels[level], `calendar-effects-${level}`, () => {
          ctx.setWeatherEffects(level);
          ctx.refresh();
        }, 'ui-btn');
        b.setAttribute('aria-pressed', String(ctx.weatherEffects() === level));
        settings.append(b);
      }
      settings.append(el('span', 'ui-muted ui-small', texts.calendar.effectsHint));
      body.append(settings);
    },
  };
}
