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
  return errors;
}
