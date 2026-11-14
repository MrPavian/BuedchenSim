import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import { SPECIALTY_PRODUCT } from '../content/regions/ruhrgebiet/specialty';
import { conditionsHold } from '../game/conditions';
import { routineChance } from '../game/demand';
import { dateOfDay } from '../game/date';
import { createGame, type Game } from '../game/game';
import { parseSave, serializeSave } from '../game/save/save';
import { slotCapacityFor } from '../game/selectors';
import type { GameState } from '../game/state';

/**
 * The binding integration scenario of Auftrag 05 (section 13): "Heißer Samstag mit Heimspiel". With seed 7 a heat wave
 * covers Saturday 24 July 2027 (day 48), which is a home match day of SV Grubenlicht 09.
 */

const SEED = 7;
const SATURDAY = 48;
const FOOTBALL = 'event.fussballspieltag';
const HEAT = 'event.hitzewelle';
const PILS = 'product.puettbraeu-pils';
const BRAUSE = 'product.ruhrbrause-brause-klassik';
const MASSE = 'product.zur-glocke-frikadellenmasse';
const BROETCHEN = 'product.pottbaecker-broetchen';
const SENF = 'product.pottgold-senf';
const ZWIEBELN = 'product.pottgold-roestzwiebeln';
const OLE = 'npc.ole';

const mutable = (game: Game): GameState => game.state as unknown as GameState;

function setClock(game: Game, day: number, minute: number): void {
  const c = mutable(game).calendar;
  c.day = day;
  c.minute = minute;
  c.phase = 'open';
}

function runUntil(game: Game, predicate: () => boolean, maxSeconds: number): boolean {
  for (let i = 0; i < maxSeconds * 60; i += 1) {
    if (predicate()) return true;
    game.tick(1 / 60);
  }
  return predicate();
}

/** Moves units from storage to free presentation slots of the right kind (the normal restock action), slot by slot. */
function restockAll(game: Game, productId: string, quantity: number): void {
  const product = game.content.products[productId];
  let left = quantity;
  for (const slot of game.content.stockSlots) {
    if (left === 0) break;
    if (slot.accepts !== product?.storage || game.state.economy.shelves[slot.id]) continue;
    const n = Math.min(left, slotCapacityFor(game.content, slot.id, productId));
    if (n === 0) continue;
    expect(game.economy.restock(slot.id, productId, n)).toEqual({ ok: true });
    left -= n;
  }
  if (left > 0) throw new Error(`no room for ${left} x ${productId}`);
}

describe('Heißer Samstag mit Heimspiel (Auftrag 05, 13)', () => {
  it('plays through forecast, ordering, production, sales, event end, day close and a restart', () => {
    const game = createGame(ruhrgebietPack, undefined, SEED);
    expect(dateOfDay(SATURDAY)).toMatchObject({ year: 2027, month: 7, dayOfMonth: 24, weekday: 5 });

    // 1.-2. Thursday: the forecast announces the heat wave, the calendar the home match.
    setClock(game, SATURDAY - 2, 9 * 60);
    const forecast = game.weather.forecast()[2];
    expect(forecast?.condition).not.toBeNull();
    expect(forecast?.high).toBeGreaterThanOrEqual(30);
    expect(game.events.onDay(SATURDAY).map((e) => e.id)).toEqual(expect.arrayContaining([FOOTBALL, HEAT]));
    const states = Object.fromEntries(game.events.current().map((e) => [e.def.id, e.status]));
    expect(states[FOOTBALL]).toBe('announced');
    // With this seed the heat wave already starts on Thursday and lasts over the weekend.
    expect(['announced', 'active']).toContain(states[HEAT]);
    // The outlook for Saturday shows more demand for beer and cold drinks than a usual day.
    const outlook = game.demand.outlook()[2]?.groups ?? [];
    expect(outlook.find((g) => g.label === 'Bier')?.delta ?? 0).toBeGreaterThan(10);
    expect(outlook.find((g) => g.label === 'Kaltgetränke')?.delta ?? 0).toBeGreaterThan(10);

    // 3. The player orders extra drinks and the ingredients; the delivery goes to the back storage.
    const cashBefore = game.state.economy.cashCents;
    const order = [
      { productId: PILS, quantity: 24 },
      { productId: BRAUSE, quantity: 12 },
      { productId: MASSE, quantity: 2 },
      { productId: BROETCHEN, quantity: 12 },
      { productId: SENF, quantity: 2 },
      { productId: ZWIEBELN, quantity: 2 },
    ];
    expect(game.economy.placeOrder(order)).toEqual({ ok: true });
    expect(game.economy.receiveDelivery()).toEqual({ ok: true });
    const orderCents = cashBefore - game.state.economy.cashCents;
    expect(orderCents).toBe(order.reduce((sum, l) => sum + (game.content.products[l.productId]?.purchasePriceCents ?? 0) * l.quantity, 0));

    // 4. Saturday begins: the weather is what the forecast said.
    setClock(game, SATURDAY, 6 * 60);
    const today = game.weather.environment();
    expect(today.weather.condition).toBe(forecast?.condition);
    expect(today.weather.high).toBe(forecast?.high);
    expect(today.eventsToday).toEqual(expect.arrayContaining([FOOTBALL, HEAT]));
    const before = structuredClone(game.state.economy.today);

    // 6. Production: two batches with roasted onions, 80 minutes of game time.
    setClock(game, SATURDAY, 9 * 60);
    expect(game.specialty.startProduction('specialty.frikadelle', 2, true)).toEqual({ ok: true });
    expect(game.state.economy.storage[MASSE]).toBeUndefined();
    setClock(game, SATURDAY, 9 * 60 + 80);
    game.tick(1 / 60);
    expect(game.state.economy.storage[SPECIALTY_PRODUCT]).toBe(12);
    expect(game.state.story.flags['specialty.frikadelle.tried']).toBe(true);
    restockAll(game, SPECIALTY_PRODUCT, 12);
    restockAll(game, PILS, 12);
    mutable(game).kiosk.shutterOpen = true;

    // 5. + 8. The match is on from 11:00: more visitors (a guest who only comes on match days), event dialogues.
    setClock(game, SATURDAY, 11 * 60 + 30);
    const env = game.weather.environment();
    expect(env.activeEvents).toContain(FOOTBALL);
    const oleDef = game.content.npcs[OLE];
    const oleEntry = oleDef?.routine.find((r) => r.id === 'o.vor-dem-spiel');
    if (!oleDef || !oleEntry) throw new Error('Ole');
    expect(routineChance(oleEntry, oleDef, env, game.content.events)).toBe(100);
    expect(runUntil(game, () => game.state.npcs[OLE]?.status !== 'away', 240)).toBe(true);
    const heimspiel = game.content.dialogues['dialogue.guenter.heimspiel'];
    expect(conditionsHold(heimspiel?.when, { ...game.state, env: game.weather.environment() })).toBe(true);
    expect(game.demand.forProduct(PILS)?.events ?? 0).toBeGreaterThan(0);

    // 7. Regulars buy the specialty (through the normal sales domain).
    for (const npcId of ['npc.guenter', 'npc.derya', 'npc.marlene']) {
      const sale = game.economy.completeSale({ lines: [{ productId: SPECIALTY_PRODUCT, quantity: 1 }], ageCheckConfirmed: false, customer: { npcId } });
      expect(sale.ok, npcId).toBe(true);
    }
    const sold = game.state.specialties['specialty.frikadelle'];
    expect(sold?.sold).toBeGreaterThanOrEqual(3);
    expect(sold?.feedback.length).toBeGreaterThanOrEqual(3);
    expect(game.state.npcs['npc.guenter']?.memories).toContain('probiert:frikadelle');

    // 9. The match ends at 20:00: no more event bonus, the guest's routine no longer applies.
    setClock(game, SATURDAY, 20 * 60);
    game.tick(1 / 60);
    const after = game.weather.environment();
    expect(after.activeEvents).not.toContain(FOOTBALL);
    expect(game.demand.forProduct(PILS)?.events ?? 0).toBe(game.content.events?.filter((e) => after.activeEvents.includes(e.id)).reduce((s, e) => s + (e.demand['tag:matchday'] ?? 0), 0));
    expect(conditionsHold(oleEntry.when, { ...game.state, env: after })).toBe(false);
    expect(routineChance(oleEntry, oleDef, after, game.content.events)).toBe(oleEntry.chancePercent + (oleDef.weatherResponse?.[after.weather.condition] ?? 0) + (after.temperature >= 28 ? (oleDef.weatherResponse?.hot ?? 0) : 0));

    // 10. Day close: revenue, cost of goods and purchases add up.
    const sales = game.state.economy.transactions.filter((t) => t.kind === 'sale' && t.day === SATURDAY);
    const revenue = sales.reduce((s, t) => s + t.totalCents, 0);
    const cogs = sales.flatMap((t) => t.lines).reduce((s, l) => s + (game.content.products[l.productId]?.purchasePriceCents ?? 0) * l.quantity, 0);
    setClock(game, SATURDAY, 22 * 60);
    const close = game.economy.closeDay();
    expect(close.ok).toBe(true);
    if (!close.ok) return;
    expect(close.report.revenueCents - before.revenueCents).toBe(revenue);
    expect(close.report.costOfGoodsSoldCents - before.costOfGoodsSoldCents).toBe(cogs);
    expect(close.report.grossProfitCents).toBe(close.report.revenueCents - close.report.costOfGoodsSoldCents);
    expect(close.report.salesCount).toBe(game.state.economy.today.salesCount);

    // 11. Restart: save, parse, a new game from the save; calendar, weather, events, goods and specialty are intact.
    const json = serializeSave(mutable(game));
    const parsed = parseSave(json, ruhrgebietPack);
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') return;
    const restarted = createGame(ruhrgebietPack, parsed.state);
    expect(restarted.state).toEqual(game.state);
    expect(restarted.weather.onDay(SATURDAY)).toEqual(game.weather.onDay(SATURDAY));
    expect(restarted.events.onDay(SATURDAY).map((e) => e.id)).toEqual(game.events.onDay(SATURDAY).map((e) => e.id));
    expect(restarted.state.specialties['specialty.frikadelle']).toEqual(game.state.specialties['specialty.frikadelle']);
    expect(restarted.state.economy.lastReport).toEqual(close.report);
    // And once more: save the restarted game and load it again.
    const again = parseSave(serializeSave(mutable(restarted)), ruhrgebietPack);
    expect(again.status === 'ok' && again.state).toEqual(parsed.state);
  });
});
