import { dateOfDay } from '../game/date';
import type { Game } from '../game/game';
import { shelfQuantity, storageQuantity } from '../game/selectors';
import { batchQuality, type FeedbackRating } from '../game/specialty';
import { formatClock } from './format';
import { texts } from './texts';

/** Specialty tab of the goods panel (Auftrag 05, 5.5). Pure: reads the state, changes nothing. */

export interface IngredientView {
  productId: string;
  name: string;
  perBatch: number;
  inStorage: number;
  enough: boolean;
}

export interface RequirementView {
  label: string;
  current: string;
  target: string;
  met: boolean;
}

export interface SpecialtyView {
  id: string;
  name: string;
  stage: number;
  stageLabel: string;
  recipeInfo: string;
  ingredients: IngredientView[];
  optional: (IngredientView & { label: string; qualityBonus: number }) | null;
  maxBatches: number;
  /** Batches the required ingredients allow right now (capped at maxBatches). */
  possibleBatches: number;
  batchSize: number;
  minutesPerBatch: number;
  /** Quality of the next batch without / with the optional ingredient. */
  expectedQuality: { plain: number; withOptional: number };
  production: { units: number; quality: number; progress: number; readyClock: string; remainingMinutes: number } | null;
  finished: { storage: number; counter: number; quality: number | null; qualityLabel: string };
  fame: number;
  stats: string;
  satisfaction: string;
  feedback: { text: string; rating: FeedbackRating; when: string }[];
  next: { name: string; requirements: RequirementView[]; unlocks: string } | null;
}

export function qualityWord(q: number): string {
  let word = '';
  for (const [threshold, w] of Object.entries(texts.specialty.qualityWords)) if (q >= Number(threshold)) word = w;
  return word;
}

function whenLabel(day: number, minute: number): string {
  const d = dateOfDay(day);
  return `${texts.calendar.dayLabel(texts.weekdayShort[d.weekday], texts.dateShort(d.dayOfMonth, d.month))} · ${formatClock(minute)}`;
}

const absolute = (day: number, minute: number): number => day * 1440 + minute;

export function buildSpecialtyViews(game: Pick<Game, 'state' | 'content' | 'specialty'>): SpecialtyView[] {
  const state = game.state;
  const now = absolute(state.calendar.day, state.calendar.minute);
  const nameOf = (id: string): string => (Object.hasOwn(game.content.products, id) ? (game.content.products[id]?.name ?? id) : id);
  return game.specialty.list().map(({ def, recipe, state: s }) => {
    const ing = (productId: string, perBatch: number): IngredientView => {
      const inStorage = storageQuantity(state, productId);
      return { productId, name: nameOf(productId), perBatch, inStorage, enough: inStorage >= perBatch };
    };
    const ingredients = recipe.ingredients.map((i) => ing(i.productId, i.quantity));
    const opt = recipe.optional[0];
    const possible = Math.min(recipe.maxBatches, ...recipe.ingredients.map((i) => Math.floor(storageQuantity(state, i.productId) / i.quantity)));
    const stageName = s.stage === 0 ? texts.specialty.notYet : s.stage === 1 ? def.firstStageName : (def.stages.find((st) => st.stage === s.stage)?.name ?? '');
    const p = s.production;
    const total = p ? p.readyAt - p.startedAt : 0;
    const mean = s.ratings > 0 ? Math.round(s.satisfactionSum / s.ratings) : null;
    const repeat = Object.values(s.buyers).filter((n) => n >= 2).length;
    const nextDef = def.stages.find((st) => st.stage === s.stage + 1);
    let next: SpecialtyView['next'] = null;
    if (s.stage === 0) {
      next = {
        name: def.firstStageName,
        requirements: [{ label: texts.specialty.req.firstBatch, current: '0', target: '1', met: false }],
        unlocks: '',
      };
    } else if (nextDef) {
      const r = (label: string, current: number, target: number, shown = String(current)): RequirementView => ({ label, current: shown, target: String(target), met: current >= target });
      next = {
        name: nextDef.name,
        requirements: [
          r(texts.specialty.req.fame, s.fame, nextDef.minFame, String(Math.round(s.fame))),
          r(texts.specialty.req.sold, s.sold, nextDef.minSold),
          r(texts.specialty.req.repeat, repeat, nextDef.minRepeatBuyers),
          ...(nextDef.minRecommendations > 0 ? [r(texts.specialty.req.recommendations, s.recommendations, nextDef.minRecommendations)] : []),
          r(texts.specialty.req.satisfaction, mean ?? 0, nextDef.minSatisfaction, mean === null ? '–' : String(mean)),
        ],
        unlocks: texts.specialty.unlocks[nextDef.stage] ?? '',
      };
    }
    return {
      id: def.id,
      name: def.name,
      stage: s.stage,
      stageLabel: texts.specialty.stage(stageName, s.stage),
      recipeInfo: texts.specialty.recipeInfo(recipe.batchSize, recipe.minutesPerBatch, s.recipeLevel),
      ingredients,
      optional: opt ? { ...ing(opt.productId, opt.quantity), label: opt.label, qualityBonus: opt.qualityBonus } : null,
      maxBatches: recipe.maxBatches,
      possibleBatches: Math.max(0, possible),
      batchSize: recipe.batchSize,
      minutesPerBatch: recipe.minutesPerBatch,
      expectedQuality: {
        plain: batchQuality(recipe, s.recipeLevel, s.batchesProduced, 0),
        withOptional: batchQuality(recipe, s.recipeLevel, s.batchesProduced, opt?.qualityBonus ?? 0),
      },
      production: p
        ? {
            units: p.units,
            quality: p.quality,
            progress: total > 0 ? Math.min(1, Math.max(0, (now - p.startedAt) / total)) : 1,
            readyClock: formatClock(p.readyAt % 1440),
            remainingMinutes: Math.max(0, Math.ceil(p.readyAt - now)),
          }
        : null,
      finished: {
        storage: storageQuantity(state, recipe.productId),
        counter: shelfQuantity(state, recipe.productId),
        quality: s.stockQuality,
        qualityLabel: s.stockQuality === null ? '–' : `${s.stockQuality}/100 (${qualityWord(s.stockQuality)})`,
      },
      fame: Math.round(s.fame),
      stats: texts.specialty.stats(s.sold, repeat, s.recommendations),
      satisfaction: texts.specialty.satisfaction(mean),
      feedback: s.feedback.map((f) => ({ text: f.text, rating: f.rating, when: whenLabel(f.day, f.minute) })),
      next,
    };
  });
}
