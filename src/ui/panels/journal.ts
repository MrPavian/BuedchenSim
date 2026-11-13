import { el, testId } from '../dom';
import type { Panel, PanelContext } from '../modal';
import { buildJournalView, type JournalQuest } from '../socialViewModel';
import { texts } from '../texts';

/** Notes: people met, stories in progress (current step only), finished stories. Read-only. */
export function createJournalPanel(ctx: PanelContext): Panel {
  const { game } = ctx;
  const questEntry = (q: JournalQuest): HTMLElement => {
    const entry = testId(el('div', 'ui-journal-entry'), `journal-quest-${q.questId}`);
    entry.append(el('strong', undefined, q.title), el('p', 'ui-muted', q.text));
    return entry;
  };
  return {
    id: 'journal',
    title: () => texts.journal.title,
    reset() {},
    render(body) {
      const view = buildJournalView(game.content, game.state);

      body.append(el('h3', 'ui-subtitle', texts.journal.people));
      if (view.people.length === 0) body.append(testId(el('p', 'ui-muted', texts.journal.noPeople), 'journal-no-people'));
      for (const p of view.people) {
        const entry = testId(el('div', 'ui-journal-entry'), `journal-person-${p.npcId}`);
        const head = el('div', 'ui-dialogue-head');
        head.append(el('strong', undefined, p.name), el('span', 'ui-muted ui-small', p.role));
        const tier = el('span', 'ui-dialogue-tier', p.tierLabel);
        tier.title = p.tierTitle;
        tier.dataset['tier'] = p.tier;
        head.append(tier);
        entry.append(head, el('p', 'ui-muted', p.bio));
        const meta = [p.lastTalk, p.servedText].filter((t): t is string => t !== null).join(' · ');
        entry.append(el('p', 'ui-small ui-muted', meta));
        body.append(entry);
      }

      body.append(el('h3', 'ui-subtitle', texts.journal.active));
      if (view.active.length === 0) body.append(testId(el('p', 'ui-muted', texts.journal.noActive), 'journal-no-active'));
      for (const q of view.active) body.append(questEntry(q));

      if (view.finished.length > 0) {
        body.append(el('h3', 'ui-subtitle', texts.journal.finished));
        for (const q of view.finished) body.append(questEntry(q));
      }
    },
  };
}
