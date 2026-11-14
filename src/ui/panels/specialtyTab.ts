import type { Game } from '../../game/game';
import { button, el, testId } from '../dom';
import { buildSpecialtyViews } from '../specialtyViewModel';
import { texts } from '../texts';

/** UI choices of the specialty tab (per panel session, never saved). */
export interface SpecialtyUi {
  batches: number;
  useOptional: boolean;
}

export interface SpecialtyTabActions {
  start(specialtyId: string, batches: number, useOptional: boolean): void;
  changed(): void;
}

function bar(value: number, id: string): HTMLElement {
  const outer = testId(el('div', 'ui-meter'), id);
  outer.setAttribute('role', 'meter');
  outer.setAttribute('aria-valuemin', '0');
  outer.setAttribute('aria-valuemax', '100');
  outer.setAttribute('aria-valuenow', String(Math.round(value)));
  const inner = el('div', 'ui-meter-fill');
  inner.style.width = `${Math.max(0, Math.min(100, value))}%`;
  outer.append(inner);
  return outer;
}

/** Recipe, ingredients, production, finished stock, quality, fame, feedback and the next stage (Auftrag 05, 9.7). */
export function renderSpecialtyTab(body: HTMLElement, game: Pick<Game, 'state' | 'content' | 'specialty'>, ui: SpecialtyUi, actions: SpecialtyTabActions): void {
  for (const v of buildSpecialtyViews(game)) {
    const box = testId(el('section', 'ui-specialty'), `specialty-${v.id}`);
    box.dataset['stage'] = String(v.stage);
    const head = el('div', 'ui-dialogue-head');
    head.append(el('strong', undefined, v.name), testId(el('span', 'ui-calendar-status', v.stageLabel), 'specialty-stage'));
    box.append(head);

    // Recipe and ingredients.
    box.append(el('h3', 'ui-subtitle', texts.specialty.recipe), el('p', 'ui-muted ui-small', v.recipeInfo));
    const table = el('div', 'ui-table ui-table-specialty');
    const th = el('div', 'ui-row ui-head');
    th.append(el('span', undefined, texts.specialty.ingredient), el('span', 'ui-num', texts.specialty.perBatch), el('span', 'ui-num', texts.specialty.inStorage));
    table.append(th);
    const rows = [...v.ingredients, ...(v.optional ? [{ ...v.optional, name: `${v.optional.name} (${texts.specialty.optional})` }] : [])];
    for (const i of rows) {
      const row = testId(el('div', 'ui-row'), `specialty-ingredient-${i.productId}`);
      if (!i.enough) row.dataset['missing'] = 'true';
      row.append(el('span', undefined, i.name), el('span', 'ui-num', String(i.perBatch)), el('span', i.enough ? 'ui-num' : 'ui-num ui-warn', String(i.inStorage)));
      table.append(row);
    }
    box.append(table, testId(el('p', 'ui-small', texts.specialty.canMake(v.possibleBatches)), 'specialty-possible'));

    // Production.
    box.append(el('h3', 'ui-subtitle', texts.specialty.production));
    if (v.production) {
      box.append(
        testId(el('p', undefined, texts.specialty.running(v.production.units, v.production.readyClock, v.production.remainingMinutes)), 'specialty-running'),
        bar(v.production.progress * 100, 'specialty-progress'),
      );
    } else {
      box.append(el('p', 'ui-muted ui-small', texts.specialty.idle));
      ui.batches = Math.max(1, Math.min(v.maxBatches, ui.batches));
      const controls = el('div', 'ui-specialty-controls');
      controls.append(el('span', undefined, `${texts.specialty.batches}:`));
      for (let n = 1; n <= v.maxBatches; n += 1) {
        const b = button(String(n), `specialty-batches-${n}`, () => {
          ui.batches = n;
          actions.changed();
        }, 'ui-btn');
        b.setAttribute('aria-pressed', String(ui.batches === n));
        controls.append(b);
      }
      if (v.optional) {
        const label = el('label', 'ui-check');
        const check = el('input');
        check.type = 'checkbox';
        check.checked = ui.useOptional;
        check.disabled = v.optional.inStorage < v.optional.perBatch * ui.batches;
        if (check.disabled) ui.useOptional = false;
        testId(check, 'specialty-optional');
        check.addEventListener('change', () => {
          ui.useOptional = check.checked;
          actions.changed();
        });
        label.append(check, el('span', undefined, texts.specialty.useOptional(v.optional.label, v.optional.qualityBonus)));
        controls.append(label);
      }
      box.append(controls);
      const q = ui.useOptional ? v.expectedQuality.withOptional : v.expectedQuality.plain;
      box.append(testId(el('p', 'ui-muted ui-small', texts.specialty.expected(q, v.batchSize * ui.batches, v.minutesPerBatch * ui.batches)), 'specialty-expected'));
      const start = button(texts.specialty.start, 'specialty-start', () => actions.start(v.id, ui.batches, ui.useOptional), 'ui-btn primary');
      start.disabled = v.possibleBatches < ui.batches;
      box.append(start);
    }

    // Finished stock and quality.
    box.append(el('h3', 'ui-subtitle', texts.specialty.finished));
    box.append(
      testId(el('p', undefined, texts.specialty.finishedInfo(v.finished.storage, v.finished.counter)), 'specialty-finished'),
      testId(el('p', undefined, `${texts.specialty.quality}: ${v.finished.qualityLabel}`), 'specialty-quality'),
      el('p', 'ui-muted ui-small', texts.specialty.finishedHint),
    );

    // Fame, feedback, next stage.
    box.append(el('h3', 'ui-subtitle', `${texts.specialty.fame}: ${v.fame}/100`), bar(v.fame, 'specialty-fame'));
    box.append(el('p', 'ui-small', `${v.stats} · ${v.satisfaction}`));
    if (v.next) {
      const next = testId(el('div', 'ui-specialty-next'), 'specialty-next');
      next.append(el('strong', undefined, texts.specialty.next(v.next.name)));
      const list = el('ul', 'ui-specialty-reqs');
      for (const r of v.next.requirements) {
        const li = el('li', r.met ? 'met' : undefined, `${r.met ? '✓' : '○'} ${r.label}: ${r.current} / ${r.target}`);
        list.append(li);
      }
      next.append(list);
      if (v.next.unlocks) next.append(el('p', 'ui-muted ui-small', v.next.unlocks));
      box.append(next);
    } else {
      box.append(testId(el('p', 'ui-specialty-next', texts.specialty.top), 'specialty-next'));
    }
    box.append(el('h3', 'ui-subtitle', texts.specialty.feedback));
    const fb = testId(el('div', 'ui-specialty-feedback'), 'specialty-feedback');
    if (v.feedback.length === 0) fb.append(el('p', 'ui-muted ui-small', texts.specialty.noFeedback));
    for (const f of v.feedback.slice(0, 6)) {
      const p = el('p', `ui-small ui-feedback-${f.rating}`);
      p.append(el('span', 'ui-muted', `${f.when} – `), el('span', undefined, f.text));
      fb.append(p);
    }
    box.append(fb);
    body.append(box);
  }
}
