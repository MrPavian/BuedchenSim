import { describe, expect, it } from 'vitest';
import { evaluateCondition } from './conditions';
import type { EventDef } from './eventCalendar';
import type { Game } from './game';
import { createInitialState } from './state';
import { testPack } from './testing/fixture-pack';
import { mutable, newGame, openShutter, run, runUntil, setTime } from './testing/harness';
import type { ContentPack, NpcDef } from './types';
import { wishCostCents } from './wishes';

const STAMM = 'npc.stammkunde';
const NACH = 'npc.nachbarin';
const HOME = 'household.test-paar';

const fest: EventDef = {
  id: 'event.test-fest',
  name: 'Testfest',
  description: 'Das ganze Jahr.',
  schedule: { kind: 'dateRange', from: { month: 1, dayOfMonth: 1 }, to: { month: 12, dayOfMonth: 31 } },
  announceDays: 0,
  productGroups: [],
  demand: {},
  visitorBonus: 0,
  memory: 'erlebt:testfest',
};

/** The fixture pack with a couple household (regular + neighbour), an all-year event and optional purses. */
function pack(purses: Record<string, number> = {}): ContentPack {
  const p: ContentPack = structuredClone(testPack);
  p.events = [fest];
  p.households = [{ id: HOME, name: 'Test', kind: 'couple', home: 'Testweg 1', memberIds: [STAMM, NACH] }];
  for (const id of [STAMM, NACH]) (p.npcs[id] as NpcDef).householdId = HOME;
  for (const [id, cents] of Object.entries(purses)) (p.npcs[id] as NpcDef).purseCents = cents;
  // Only the regular shops; the others stay home.
  for (const id of Object.keys(p.npcs)) if (id !== STAMM) (p.npcs[id] as NpcDef).routine = [];
  return p;
}

function arriveAtWindow(game: Game): void {
  setTime(game, 480);
  expect(runUntil(game, () => mutable(game).npcs[STAMM]?.status === 'at_place', 120)).toBe(true);
}

describe('households (Auftrag 05, 5.6)', () => {
  it('start with an empty shared state per household of the content', () => {
    expect(createInitialState(pack()).households).toEqual({ [HOME]: { memories: [] } });
  });

  it('an event one member lives through becomes a shared household memory; the other member keeps its own memories', () => {
    const game = newGame(7, pack());
    arriveAtWindow(game);
    const state = mutable(game);
    expect(state.npcs[STAMM]?.memories).toContain('erlebt:testfest');
    expect(state.households[HOME]?.memories).toEqual(['erlebt:testfest']);
    expect(state.npcs[NACH]?.memories).not.toContain('erlebt:testfest');
    const ctx = { ...state, env: game.weather.environment() };
    expect(evaluateCondition({ type: 'householdMemory', householdId: HOME, memoryId: 'erlebt:testfest' }, ctx)).toBe(true);
    expect(evaluateCondition({ type: 'householdMemory', householdId: 'household.unknown', memoryId: 'erlebt:testfest' }, ctx)).toBe(false);
  });

  it('members visit independently: the routine of one never moves the other', () => {
    const game = newGame(7, pack());
    arriveAtWindow(game);
    run(game, 5);
    expect(mutable(game).npcs[NACH]?.status).toBe('away');
  });
});

describe('purse (Auftrag 05, 5.6)', () => {
  it('costs a wish at the suggested prices', () => {
    expect(wishCostCents(testPack, { lines: [{ productId: 'product.test-water', quantity: 2 }] })).toBe(200);
  });

  it('a resident never wishes what its purse cannot pay; with enough money it wishes as before', () => {
    const wishes = (purse: number): (string | null)[] => {
      const game = newGame(7, pack({ [STAMM]: purse }));
      arriveAtWindow(game);
      const seen: (string | null)[] = [];
      game.signals.on('npc.wish', (p) => seen.push(p.wishId));
      openShutter(game);
      run(game, 2);
      return seen;
    };
    expect(wishes(1000)).toEqual(['wish.water']);
    expect(wishes(150)).toEqual([]); // two waters cost 2,00 €
  });
});

describe('households in the savegame (version 4)', () => {
  it('roundtrip keeps shared memories; a version-3 file gets empty households; unknown ones are dropped', async () => {
    const { parseSave, serializeSave } = await import('./save/save');
    const content = pack();
    const state = createInitialState(content);
    state.households[HOME] = { memories: ['erlebt:testfest'] };
    const again = parseSave(serializeSave(state), content);
    expect(again.status === 'ok' && again.state.households).toEqual({ [HOME]: { memories: ['erlebt:testfest'] } });
    const v3 = JSON.parse(serializeSave(state)) as { schemaVersion: number; state: Record<string, unknown> };
    v3.schemaVersion = 3;
    delete v3.state['households'];
    delete v3.state['specialties'];
    const migrated = parseSave(JSON.stringify(v3), content);
    expect(migrated.status === 'ok' && migrated.state.households).toEqual({ [HOME]: { memories: [] } });
    const unknown = JSON.parse(serializeSave(state)) as { state: { households: Record<string, unknown> } };
    unknown.state.households['household.gone'] = { memories: [] };
    const dropped = parseSave(JSON.stringify(unknown), content);
    expect(dropped.status === 'ok' && Object.keys(dropped.state.households)).toEqual([HOME]);
  });
});
