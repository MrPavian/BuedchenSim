import { STORAGE_CAPACITY_UNITS } from './balance';
import type { DomainContext } from './domain';
import { roll } from './random';
import type { ActionResult } from './result';
import { shelfQuantity, storageQuantity } from './selectors';
import type { Transaction } from './state';
import { addMemory } from './story';

/**
 * Kiosk specialties (Auftrag 05, 5.5): recipes made from ingredients in the normal storage, produced over game time,
 * sold through the normal sales domain. Quality, fame and the development stage live in the saved state; the system
 * supports several specialties, the content defines one ("Frikadelle im Brötchen").
 */

export interface RecipeIngredient {
  productId: string;
  /** Units per batch. */
  quantity: number;
}

export interface RecipeDef {
  /** Prefix 'recipe.'. */
  id: string;
  name: string;
  /** The finished product (a normal catalog product). */
  productId: string;
  /** Finished units per batch. */
  batchSize: number;
  /** Game minutes per batch. */
  minutesPerBatch: number;
  maxBatches: number;
  /** Required per batch. */
  ingredients: RecipeIngredient[];
  /** Optional per batch: used when chosen and in stock, raises the quality. */
  optional: (RecipeIngredient & { label: string; qualityBonus: number })[];
  quality: {
    /** Quality of recipe level 1. */
    base: number;
    /** Added per recipe level above 1. */
    perLevel: number;
    /** Practice: added per batch produced so far, up to `practiceCap`. */
    practicePerBatch: number;
    practiceCap: number;
  };
}

export interface SpecialtyStageDef {
  stage: 2 | 3;
  name: string;
  minFame: number;
  minSold: number;
  minRepeatBuyers: number;
  minRecommendations: number;
  /** Mean satisfaction of residents who tasted it (0..100): a poor product never reaches the stage. */
  minSatisfaction: number;
  /** Story flag set on reaching the stage (unlocks a sign, a decoration, dialogues). */
  flag: string;
  /** Recipe level unlocked with the stage. */
  recipeLevel: number;
}

export interface SpecialtyDef {
  /** Prefix 'specialty.'. */
  id: string;
  name: string;
  recipeId: string;
  /** Name of stage 1 (after the first batch). */
  firstStageName: string;
  /** Story flag set when the first batch is ready (residents start to ask for it). */
  firstFlag?: string;
  stages: SpecialtyStageDef[];
  /** Feedback lines by rating; `{name}` is replaced by the resident's first name. */
  feedback: Record<FeedbackRating, string[]>;
  /** Memory a resident gets when it recommends the specialty. */
  recommendMemory: string;
}

export type FeedbackRating = 'great' | 'good' | 'meh' | 'bad';

export interface SpecialtyFeedback {
  day: number;
  minute: number;
  npcId: string;
  rating: FeedbackRating;
  satisfaction: number;
  text: string;
}

export interface ProductionState {
  recipeId: string;
  batches: number;
  units: number;
  quality: number;
  /** Absolute game minute (day * 1440 + minute) when the batch is ready. */
  startedAt: number;
  readyAt: number;
}

export interface SpecialtyState {
  /** 0 = never produced; 1 first attempt; 2 insider tip; 3 cult status. */
  stage: number;
  /** 0..100 */
  fame: number;
  recipeLevel: number;
  batchesProduced: number;
  /** Quality of the finished units in storage and on the counter (mean of the batches, 0..100); null before the first batch. */
  stockQuality: number | null;
  production: ProductionState | null;
  sold: number;
  /** Ratings by residents: sum and count of satisfactions. */
  satisfactionSum: number;
  ratings: number;
  /** Units bought per resident. */
  buyers: Record<string, number>;
  recommendations: number;
  /** Newest first, at most FEEDBACK_LIMIT. */
  feedback: SpecialtyFeedback[];
}

export const FEEDBACK_LIMIT = 12;

export function createInitialSpecialty(): SpecialtyState {
  return {
    stage: 0,
    fame: 0,
    recipeLevel: 1,
    batchesProduced: 0,
    stockQuality: null,
    production: null,
    sold: 0,
    satisfactionSum: 0,
    ratings: 0,
    buyers: {},
    recommendations: 0,
    feedback: [],
  };
}

const absolute = (day: number, minute: number): number => day * 1440 + minute;
const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

/** Quality of a new batch (pure). */
export function batchQuality(recipe: RecipeDef, recipeLevel: number, batchesProduced: number, optionalBonus: number): number {
  const q = recipe.quality;
  const practice = Math.min(q.practiceCap, batchesProduced * q.practicePerBatch);
  return clamp(Math.round(q.base + q.perLevel * (recipeLevel - 1) + optionalBonus + practice), 0, 100);
}

export interface SpecialtyApi {
  /** The specialty, its recipe and its state. */
  list(): { def: SpecialtyDef; recipe: RecipeDef; state: SpecialtyState }[];
  /**
   * Starts a production: needs the day open, no running production of this specialty, the ingredients in storage and
   * room for the finished units. Consumes the ingredients at once; the units arrive in storage after the production time.
   */
  startProduction(specialtyId: string, batches: number, useOptional: boolean): ActionResult;
  /** Called on every game tick: finishes due productions. */
  tick(): void;
  /** Evaluates a completed sale (feedback, fame, stage). Wired to `sale.completed`. */
  onSale(transaction: Transaction): void;
}

export function createSpecialtyApi(ctx: DomainContext): SpecialtyApi {
  const { content } = ctx;
  const defs = content.specialties ?? [];
  const recipeOf = (def: SpecialtyDef): RecipeDef | undefined => (content.recipes ?? []).find((r) => r.id === def.recipeId);
  const stateOf = (id: string): SpecialtyState => {
    const all = ctx.state().specialties;
    let s = Object.hasOwn(all, id) ? all[id] : undefined;
    if (!s) {
      s = createInitialSpecialty();
      all[id] = s;
    }
    return s;
  };
  const changed = (id: string): void => ctx.emit('specialty.changed', { specialtyId: id });

  const setFlag = (id: string): void => {
    const story = ctx.state().story;
    if (story.flags[id] === true) return;
    story.flags[id] = true;
    ctx.emit('story.changed', { flag: id });
  };

  const promote = (def: SpecialtyDef, s: SpecialtyState): void => {
    const repeat = Object.values(s.buyers).filter((n) => n >= 2).length;
    const mean = s.ratings > 0 ? s.satisfactionSum / s.ratings : 0;
    for (const stage of [...def.stages].sort((a, b) => a.stage - b.stage)) {
      if (s.stage >= stage.stage || s.stage < stage.stage - 1) continue;
      if (s.fame < stage.minFame || s.sold < stage.minSold || repeat < stage.minRepeatBuyers) continue;
      if (s.recommendations < stage.minRecommendations || mean < stage.minSatisfaction) continue;
      s.stage = stage.stage;
      s.recipeLevel = Math.max(s.recipeLevel, stage.recipeLevel);
      setFlag(stage.flag);
      ctx.emit('specialty.stage', { specialtyId: def.id, stage: stage.stage });
    }
  };

  return {
    list() {
      const out: { def: SpecialtyDef; recipe: RecipeDef; state: SpecialtyState }[] = [];
      for (const def of defs) {
        const recipe = recipeOf(def);
        if (recipe) out.push({ def, recipe, state: stateOf(def.id) });
      }
      return out;
    },

    startProduction(specialtyId, batches, useOptional) {
      const def = defs.find((d) => d.id === specialtyId);
      const recipe = def ? recipeOf(def) : undefined;
      if (!def || !recipe) return { ok: false, reason: 'unknown_specialty' };
      const state = ctx.state();
      if (state.calendar.phase !== 'open') return { ok: false, reason: 'day_not_open' };
      if (!Number.isSafeInteger(batches) || batches < 1 || batches > recipe.maxBatches) return { ok: false, reason: 'invalid_batches' };
      const s = stateOf(def.id);
      if (s.production) return { ok: false, reason: 'production_running' };
      for (const ing of recipe.ingredients) {
        if (storageQuantity(state, ing.productId) < ing.quantity * batches) return { ok: false, reason: 'missing_ingredients' };
      }
      const optional = useOptional ? recipe.optional.filter((o) => storageQuantity(state, o.productId) >= o.quantity * batches) : [];
      if (useOptional && optional.length === 0 && recipe.optional.length > 0) return { ok: false, reason: 'missing_optional' };
      const units = recipe.batchSize * batches;
      const used = [...recipe.ingredients, ...optional].reduce((sum, i) => sum + i.quantity * batches, 0);
      const stored = Object.values(state.economy.storage).reduce((sum, q) => sum + q, 0);
      const pending = state.economy.pendingDelivery?.lines.reduce((sum, l) => sum + l.quantity, 0) ?? 0;
      if (stored + pending - used + units > STORAGE_CAPACITY_UNITS) return { ok: false, reason: 'storage_full' };

      for (const ing of [...recipe.ingredients, ...optional]) {
        const left = storageQuantity(state, ing.productId) - ing.quantity * batches;
        if (left === 0) delete state.economy.storage[ing.productId];
        else state.economy.storage[ing.productId] = left;
        ctx.emit('product.stock.changed', { productId: ing.productId });
      }
      const bonus = optional.reduce((sum, o) => sum + o.qualityBonus, 0);
      const now = absolute(state.calendar.day, state.calendar.minute);
      s.production = {
        recipeId: recipe.id,
        batches,
        units,
        quality: batchQuality(recipe, s.recipeLevel, s.batchesProduced, bonus),
        startedAt: Math.floor(now),
        readyAt: Math.floor(now) + recipe.minutesPerBatch * batches,
      };
      changed(def.id);
      return { ok: true };
    },

    tick() {
      const state = ctx.state();
      const now = absolute(state.calendar.day, state.calendar.minute);
      for (const def of defs) {
        if (!Object.hasOwn(state.specialties, def.id)) continue;
        const s = stateOf(def.id);
        const p = s.production;
        if (!p || now < p.readyAt) continue;
        const recipe = recipeOf(def);
        if (!recipe) continue;
        const stored = storageQuantity(state, recipe.productId);
        state.economy.storage[recipe.productId] = stored + p.units;
        // Units already held (back storage and counter) mix with the new batch into one stock quality.
        const held = stored + shelfQuantity(state, recipe.productId);
        s.stockQuality = s.stockQuality === null || held === 0 ? p.quality : Math.round((s.stockQuality * held + p.quality * p.units) / (held + p.units));
        s.batchesProduced += p.batches;
        s.production = null;
        if (s.stage === 0) s.stage = 1;
        if (def.firstFlag) setFlag(def.firstFlag);
        ctx.emit('product.stock.changed', { productId: recipe.productId });
        ctx.emit('specialty.produced', { specialtyId: def.id, units: p.units, quality: p.quality });
        changed(def.id);
      }
    },

    onSale(transaction) {
      const state = ctx.state();
      for (const def of defs) {
        const recipe = recipeOf(def);
        if (!recipe) continue;
        const units = transaction.lines.filter((l) => l.productId === recipe.productId).reduce((sum, l) => sum + l.quantity, 0);
        if (units === 0) continue;
        const s = stateOf(def.id);
        s.sold += units;
        const quality = s.stockQuality ?? recipe.quality.base;
        const npcId = transaction.npcId;
        const npcDef = npcId !== undefined && Object.hasOwn(content.npcs, npcId) ? content.npcs[npcId] : undefined;
        const npc = npcId !== undefined && Object.hasOwn(state.npcs, npcId) ? state.npcs[npcId] : undefined;
        if (!npcId || !npcDef || !npc) {
          // Passers-by at the till: a small push for a good product, a small loss for a poor one.
          s.fame = clamp(s.fame + units * (quality >= 55 ? 0.4 : -0.4), 0, 100);
        } else {
          const likes = npcDef.likes.includes(recipe.productId) || npcDef.likes.includes('tag:specialty');
          const dislikes = npcDef.dislikes.includes(recipe.productId);
          const noise = (roll(state.world.seed, 'specialty-taste', transaction.id, npcId) - 0.5) * 16;
          const satisfaction = clamp(Math.round(quality + (npc.relationship - 30) / 5 + (likes ? 8 : 0) - (dislikes ? 15 : 0) + noise), 0, 100);
          const before = s.buyers[npcId] ?? 0;
          s.buyers[npcId] = before + units;
          s.ratings += 1;
          s.satisfactionSum += satisfaction;
          let delta = clamp((satisfaction - 45) / 8, -4, 5);
          if (before > 0 && satisfaction >= 55) delta += 2; // came back for more
          s.fame = clamp(s.fame + delta, 0, 100);
          const rating: FeedbackRating = satisfaction >= 75 ? 'great' : satisfaction >= 58 ? 'good' : satisfaction >= 42 ? 'meh' : 'bad';
          const lines = def.feedback[rating];
          const line = lines[Math.floor(roll(state.world.seed, 'specialty-line', transaction.id) * lines.length)] ?? '';
          const firstName = npcDef.name.split(' ')[0] ?? npcDef.name;
          s.feedback.unshift({
            day: state.calendar.day,
            minute: Math.floor(state.calendar.minute),
            npcId,
            rating,
            satisfaction,
            text: line.replace('{name}', firstName),
          });
          if (s.feedback.length > FEEDBACK_LIMIT) s.feedback.length = FEEDBACK_LIMIT;
          // Residents who like it and trust the kiosk recommend it (once each): fame grows through people.
          if (satisfaction >= 70 && npc.relationship >= 50 && !npc.memories.includes(def.recommendMemory)) {
            s.recommendations += 1;
            s.fame = clamp(s.fame + 4, 0, 100);
            addMemory(ctx, npcId, def.recommendMemory);
          }
          ctx.emit('specialty.feedback', { specialtyId: def.id, npcId, rating });
        }
        s.fame = Math.round(s.fame * 10) / 10;
        promote(def, s);
        changed(def.id);
      }
    },
  };
}
