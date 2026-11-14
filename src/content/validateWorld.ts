import { DAY_END_MINUTE, DAY_START_MINUTE } from '../game/balance';
import type { ContentPack, ProductCategory } from '../game/types';
import { WEATHER_CONDITIONS } from '../game/weather';

const CATEGORIES: readonly ProductCategory[] = ['drink', 'snack', 'sweet', 'icecream', 'bakery', 'press', 'everyday'];

/** Demand keys: 'tag:<demandTag>' used by a product, 'category:<category>' or a product id. */
export function validateDemandKey(pack: ContentPack, key: string): boolean {
  if (key.startsWith('tag:')) return Object.values(pack.products).some((p) => p.demandTags.includes(key.slice(4)));
  if (key.startsWith('category:')) return CATEGORIES.includes(key.slice(9) as ProductCategory);
  return Object.hasOwn(pack.products, key);
}

/** Climate and neighbourhood events (Auftrag 05). */
export function validateWorldContent(pack: ContentPack): string[] {
  const errors: string[] = [];
  if (pack.climate) {
    if (pack.climate.length !== 12) errors.push('climate must list twelve months');
    pack.climate.forEach((m, i) => {
      if (!(m.high > m.low)) errors.push(`climate month ${i + 1}: high must be above low`);
      const weights = Object.entries(m.weights);
      if (weights.length === 0 || weights.some(([c, w]) => !WEATHER_CONDITIONS.includes(c as never) || !(Number(w) >= 0))) {
        errors.push(`climate month ${i + 1}: weights need known conditions and non-negative values`);
      }
    });
  }
  const ids = new Set<string>();
  for (const e of pack.events ?? []) {
    if (!e.id.startsWith('event.')) errors.push(`event id "${e.id}" must start with "event."`);
    if (ids.has(e.id)) errors.push(`duplicate event id "${e.id}"`);
    ids.add(e.id);
    if (!e.name.trim() || !e.description.trim()) errors.push(`event "${e.id}" needs a name and a description`);
    if (!Number.isInteger(e.announceDays) || e.announceDays < 0) errors.push(`event "${e.id}" announceDays must be an integer >= 0`);
    if (e.hours && !(e.hours.from >= DAY_START_MINUTE && e.hours.to <= DAY_END_MINUTE && e.hours.from < e.hours.to)) {
      errors.push(`event "${e.id}" hours must lie within the opening day`);
    }
    for (const [key, value] of Object.entries(e.demand)) {
      if (!validateDemandKey(pack, key)) errors.push(`event "${e.id}" demand key "${key}" matches no product`);
      if (!Number.isFinite(value) || Math.abs(value) > 60) errors.push(`event "${e.id}" demand "${key}" must be within -60..60`);
    }
    if (!(e.visitorBonus >= 0 && e.visitorBonus <= 40)) errors.push(`event "${e.id}" visitorBonus must be within 0..40`);
    const s = e.schedule;
    if (s.kind === 'everyNthWeek' && !(s.everyWeeks >= 1)) errors.push(`event "${e.id}" everyWeeks must be >= 1`);
    if ((s.kind === 'monthlyNthWeekday' || s.kind === 'yearlyNthWeekday') && !(s.nth >= 1 && s.nth <= 4)) {
      errors.push(`event "${e.id}" nth must be 1..4`);
    }
    if (s.kind === 'heatwave' && !(s.minDays >= 1)) errors.push(`event "${e.id}" minDays must be >= 1`);
  }
  validateSpecialtyContent(pack, errors);
  return errors;
}

/** Recipes and specialties (Auftrag 05, 5.5). */
function validateSpecialtyContent(pack: ContentPack, errors: string[]): void {
  const product = (id: string) => (Object.hasOwn(pack.products, id) ? pack.products[id] : undefined);
  const recipeIds = new Set<string>();
  for (const r of pack.recipes ?? []) {
    const tag = `recipe "${r.id}"`;
    if (!r.id.startsWith('recipe.')) errors.push(`recipe id "${r.id}" must start with "recipe."`);
    if (recipeIds.has(r.id)) errors.push(`duplicate recipe id "${r.id}"`);
    recipeIds.add(r.id);
    const out = product(r.productId);
    if (!out) errors.push(`${tag}: unknown product "${r.productId}"`);
    else if (out.storage === 'ingredient') errors.push(`${tag}: the finished product must be sellable, not an ingredient`);
    for (const [field, v] of [['batchSize', r.batchSize], ['minutesPerBatch', r.minutesPerBatch], ['maxBatches', r.maxBatches]] as const) {
      if (!Number.isInteger(v) || v < 1) errors.push(`${tag}: ${field} must be a positive integer`);
    }
    if (r.ingredients.length === 0) errors.push(`${tag}: needs at least one ingredient`);
    for (const ing of [...r.ingredients, ...r.optional]) {
      if (!product(ing.productId)) errors.push(`${tag}: unknown ingredient "${ing.productId}"`);
      if (ing.productId === r.productId) errors.push(`${tag}: the product cannot be its own ingredient`);
      if (!Number.isInteger(ing.quantity) || ing.quantity < 1) errors.push(`${tag}: ingredient "${ing.productId}" needs a positive quantity`);
    }
    const q = r.quality;
    if (!(q.base >= 0 && q.base <= 100 && q.perLevel >= 0 && q.practicePerBatch >= 0 && q.practiceCap >= 0)) {
      errors.push(`${tag}: quality parameters must be non-negative (base 0..100)`);
    }
  }
  const ids = new Set<string>();
  for (const s of pack.specialties ?? []) {
    const tag = `specialty "${s.id}"`;
    if (!s.id.startsWith('specialty.')) errors.push(`specialty id "${s.id}" must start with "specialty."`);
    if (ids.has(s.id)) errors.push(`duplicate specialty id "${s.id}"`);
    ids.add(s.id);
    if (!recipeIds.has(s.recipeId)) errors.push(`${tag}: unknown recipe "${s.recipeId}"`);
    const stages = s.stages.map((st) => st.stage);
    if (stages.join(',') !== '2,3') errors.push(`${tag}: needs exactly the stages 2 and 3, in order`);
    const [two, three] = s.stages;
    if (two && three && (three.minFame < two.minFame || three.minSold < two.minSold || three.minSatisfaction < two.minSatisfaction)) {
      errors.push(`${tag}: stage 3 must not be easier than stage 2`);
    }
    for (const st of s.stages) {
      if (!(st.minSatisfaction > 0)) errors.push(`${tag}: stage ${st.stage} needs a minimum satisfaction (a poor product must never get there)`);
    }
    for (const rating of ['great', 'good', 'meh', 'bad'] as const) {
      if ((s.feedback[rating] ?? []).length === 0) errors.push(`${tag}: needs feedback lines for "${rating}"`);
    }
  }
}
