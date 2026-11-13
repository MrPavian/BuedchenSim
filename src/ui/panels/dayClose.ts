import { weekdayOf } from '../../game/selectors';
import { button, el, testId } from '../dom';
import { formatClock, formatEuro, formatEuroSigned } from '../format';
import type { Panel, PanelContext } from '../modal';
import { texts } from '../texts';
import { reasonText } from '../viewModel';

/** Confirmation before closing the day; states how an early close works. The game performs the close. */
export function createConfirmClosePanel(ctx: PanelContext): Panel {
  let message: string | null = null;
  return {
    id: 'confirmClose',
    title: () => texts.dayClose.confirmTitle,
    reset() {
      message = null;
    },
    render(body) {
      const { calendar } = ctx.game.state;
      const text =
        calendar.phase === 'awaiting_close' ? texts.dayClose.lateText : texts.dayClose.earlyText(formatClock(calendar.minute));
      body.append(testId(el('p', undefined, text), 'confirm-close-text'), el('p', 'ui-muted ui-small', texts.dayClose.keep));
      if (message !== null) {
        const box = el('div', 'ui-message error', message);
        box.setAttribute('role', 'alert');
        body.append(testId(box, 'confirm-close-message'));
      }
      const actions = el('div', 'ui-actions');
      actions.append(
        button(texts.dayClose.cancel, 'confirm-close-cancel', () => ctx.close()),
        button(texts.dayClose.confirm, 'confirm-close-confirm', () => {
          const result = ctx.game.economy.closeDay();
          if (!result.ok) {
            message = reasonText(result.reason);
            ctx.refresh();
            return;
          }
          ctx.open('report');
        }, 'ui-btn ui-btn-primary'),
      );
      body.append(actions);
    },
  };
}

/** Day report from state.economy.lastReport with the button to begin the next day. */
export function createReportPanel(ctx: PanelContext): Panel {
  let message: string | null = null;
  return {
    id: 'report',
    title: () => {
      const report = ctx.game.state.economy.lastReport;
      return report ? texts.dayClose.reportTitle(report.day, weekdayOf(report.day)) : texts.dayClose.confirmTitle;
    },
    reset() {
      message = null;
    },
    render(body) {
      const report = ctx.game.state.economy.lastReport;
      if (!report) return;
      const rows: { id: string; label: string; value: string; note?: string; strong?: boolean }[] = [
        { id: 'day', label: texts.dayClose.rows.day, value: String(report.day) },
        { id: 'revenue', label: texts.dayClose.rows.revenue, value: formatEuro(report.revenueCents) },
        {
          id: 'cogs',
          label: texts.dayClose.rows.cogs,
          value: formatEuro(report.costOfGoodsSoldCents),
          note: texts.dayClose.explain.cogs,
        },
        {
          id: 'purchases',
          label: texts.dayClose.rows.purchases,
          value: formatEuro(report.purchaseCents),
          note: texts.dayClose.explain.purchases,
        },
        {
          id: 'gross-profit',
          label: texts.dayClose.rows.grossProfit,
          value: formatEuroSigned(report.grossProfitCents),
          note: texts.dayClose.explain.grossProfit,
          strong: true,
        },
        {
          id: 'cash-flow',
          label: texts.dayClose.rows.cashFlow,
          value: formatEuroSigned(report.cashFlowCents),
          note: texts.dayClose.explain.cashFlow,
          strong: true,
        },
        { id: 'cash-end', label: texts.dayClose.rows.cashEnd, value: formatEuro(report.cashEndCents) },
        { id: 'sales', label: texts.dayClose.rows.sales, value: String(report.salesCount) },
      ];
      const list = el('div', 'ui-report');
      for (const row of rows) {
        const line = el('div', row.strong ? 'ui-report-row strong' : 'ui-report-row');
        const label = el('div', 'ui-report-label');
        label.append(el('span', undefined, row.label));
        if (row.note) label.append(el('span', 'ui-muted ui-small', row.note));
        line.append(label, testId(el('span', 'ui-num ui-money', row.value), `report-${row.id}`));
        list.append(line);
      }
      body.append(list);
      if (message !== null) {
        const box = el('div', 'ui-message error', message);
        box.setAttribute('role', 'alert');
        body.append(testId(box, 'report-message'));
      }
      const actions = el('div', 'ui-actions');
      actions.append(
        button(texts.dayClose.next, 'report-next-day', () => {
          const result = ctx.game.calendar.startNextDay();
          if (!result.ok) {
            message = reasonText(result.reason);
            ctx.refresh();
          }
          // On success the 'day.started' signal closes the panel and notifies.
        }, 'ui-btn ui-btn-primary'),
      );
      body.append(actions);
    },
  };
}
