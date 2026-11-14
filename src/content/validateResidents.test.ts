import { describe, expect, it } from 'vitest';
import type { ContentPack, DialogueDef, NpcDef } from '../game/types';
import { ruhrgebietPack } from './regions/ruhrgebiet';
import { validateContent } from './validate';
import { validateResidents } from './validateResidents';

function broken(mutate: (pack: ContentPack) => void): string[] {
  const pack = structuredClone(ruhrgebietPack);
  mutate(pack);
  return validateResidents(pack);
}
const npc = (p: ContentPack, id = 'npc.guenter'): NpcDef => p.npcs[id] as NpcDef;
const dlg = (p: ContentPack, id: string): DialogueDef => p.dialogues[id] as DialogueDef;
const has = (errors: string[], text: string): boolean => errors.some((e) => e.includes(text));

describe('validateResidents on the real pack', () => {
  it('accepts the ruhrgebiet pack, also through validateContent', () => {
    expect(validateResidents(ruhrgebietPack)).toEqual([]);
    expect(validateContent(ruhrgebietPack)).toEqual([]);
  });

  it('has four residents, two stories and the flag-gated placements', () => {
    expect(Object.keys(ruhrgebietPack.npcs).sort()).toEqual(['npc.derya', 'npc.guenter', 'npc.jonas', 'npc.marlene']);
    expect(Object.keys(ruhrgebietPack.quests).sort()).toEqual(['quest.hof', 'quest.paket']);
    const gated = ruhrgebietPack.layout.placements.filter((p) => p.requiresFlag).map((p) => [p.id, p.requiresFlag]);
    expect(gated).toEqual([['placement.yard-bench', 'yard.bench'], ['placement.kiosk-photo', 'kiosk.photo']]);
  });

  it('contains no real brands or clubs (small deny list)', () => {
    const text = JSON.stringify([ruhrgebietPack.npcs, ruhrgebietPack.dialogues, ruhrgebietPack.quests, ruhrgebietPack.customerLines]);
    for (const word of ['Coca', 'Pepsi', 'Fanta', 'Red Bull', 'Marlboro', 'BVB', 'Schalke', 'Aldi', 'Lidl', 'Haribo', 'Bild-Zeitung']) {
      expect(text, word).not.toContain(word);
    }
  });
});

describe('mutations: nav', () => {
  it('rejects bad ids, duplicates, unknown references and self edges', () => {
    const e = broken((p) => {
      const n = p.layout.nav;
      (n.waypoints[0] as { id: string }).id = 'x.bad';
      n.waypoints.push({ id: 'wp.a-1', position: { x: 0, z: 4 } });
      n.edges.push(['wp.a-1', 'wp.nowhere'], ['wp.a-2', 'wp.a-2']);
    });
    expect(has(e, 'waypoint id "x.bad" must start with "wp."')).toBe(true);
    expect(has(e, 'duplicate waypoint id "wp.a-1"')).toBe(true);
    expect(has(e, 'unknown waypoint "wp.nowhere"')).toBe(true);
    expect(has(e, 'connects a waypoint to itself')).toBe(true);
  });

  it('rejects an edge through a collider', () => {
    const e = broken((p) => {
      p.layout.nav.edges.push(['wp.win-2', 'wp.y-2']);
    });
    expect(has(e, 'is blocked by a collider')).toBe(true);
  });

  it('rejects an unreachable waypoint and a missing exit', () => {
    expect(has(broken((p) => p.layout.nav.waypoints.push({ id: 'wp.island', position: { x: 9, z: 3.9 } })), 'waypoint "wp.island" is not reachable')).toBe(true);
    expect(has(broken((p) => (p.layout.nav.places = p.layout.nav.places.filter((x) => x.id !== 'place.exit-east' && x.id !== 'place.exit-hof'))), 'at least two exits')).toBe(true);
  });

  it('rejects window spots out of talking range and spots too close together or to a lane', () => {
    expect(has(broken((p) => (p.layout.nav.waypoints.find((w) => w.id === 'wp.win-3') as { position: { x: number; z: number } }).position = { x: 0.4, z: 2.55 }), 'further than')).toBe(true);
    expect(has(broken((p) => (p.layout.nav.waypoints.find((w) => w.id === 'wp.corner-2') as { position: { x: number; z: number } }).position = { x: 4.3, z: 2.45 }), 'closer than the resident clearance')).toBe(true);
    expect(has(broken((p) => (p.layout.nav.waypoints.find((w) => w.id === 'wp.corner-2') as { position: { x: number; z: number } }).position = { x: 4.8, z: 3.0 }), 'to the lane')).toBe(true);
  });

  it('rejects a shared spot waypoint and a spot in the door approach', () => {
    expect(has(broken((p) => p.layout.nav.places.push({ id: 'place.dup', kind: 'sidewalk', spots: [{ waypointId: 'wp.corner-1', heading: 0 }] })), 'is a spot of both')).toBe(true);
    expect(has(broken((p) => (p.layout.nav.waypoints.find((w) => w.id === 'wp.corner-1') as { position: { x: number; z: number } }).position = { x: 2.0, z: 2.5 }), 'approach of door')).toBe(true);
  });
});

describe('mutations: residents, routines, wishes', () => {
  it('rejects bad profile data', () => {
    const e = broken((p) => {
      const n = npc(p);
      n.age = 71.5;
      n.assetId = 'X-2';
      n.startRelationship = 120;
      n.personalityTags = ['eins'];
      n.homeExitPlaceId = 'place.corner';
      n.likes = ['product.nope', 'tag:nope', 'product.halden-echo-lokalblatt'];
      n.dislikes = ['product.halden-echo-lokalblatt'];
      n.relationships.push({ npcId: 'npc.guenter', kind: 'x', note: 'y' }, { npcId: 'npc.ghost', kind: 'x', note: 'y' });
    });
    for (const t of ['age 71.5', 'must look like N-0xx', 'startRelationship', '2-4 personality tags', 'is not an exit', 'unknown product "product.nope"', 'unknown demand tag "tag:nope"', 'both liked and disliked', 'relationship to itself', 'unknown resident "npc.ghost"']) {
      expect(has(e, t), t).toBe(true);
    }
  });

  it('rejects duplicate residents ids, shared figure assets and N-001', () => {
    expect(has(broken((p) => (npc(p, 'npc.derya').assetId = 'N-002')), 'share the figure asset')).toBe(true);
    expect(has(broken((p) => (npc(p).assetId = 'N-001')), 'player figure')).toBe(true);
    expect(has(broken((p) => (npc(p).id = 'npc.other')), 'does not match its id')).toBe(true);
  });

  it('rejects invalid routines', () => {
    const e = broken((p) => {
      const r = npc(p).routine;
      (r[0] as { from: number }).from = 300;
      (r[1] as { weekdays: number[] }).weekdays = [7];
      (r[2] as { placeId: string }).placeId = 'place.kiosk-window';
      (r[3] as { placeId: string }).placeId = 'place.kiosk-window';
      (r[3] as { chancePercent: number }).chancePercent = 150;
      r.push({ id: 'g.morgen', weekdays: [0], from: 400, to: 500, activity: 'linger', placeId: 'place.nowhere', chancePercent: 10 });
    });
    for (const t of ['must satisfy 360 <= from', 'weekdays must be unique values 0..6', 'only shop may use the kiosk window', 'chancePercent', 'duplicate routine id', 'unknown place']) {
      expect(has(e, t), t).toBe(true);
    }
  });

  it('rejects shop at a non-window place', () => {
    expect(has(broken((p) => ((npc(p).routine[0] as { placeId: string }).placeId = 'place.corner')), 'shop is only possible')).toBe(true);
  });

  it('rejects broken wishes', () => {
    const e = broken((p) => {
      const w = npc(p, 'npc.jonas').wishes ?? [];
      (w[0] as { lines: unknown[] }).lines = [{ productId: 'product.nope', quantity: 0 }];
      (w[1] as { onSold: unknown[] }).onSold = [{ type: 'sellWish' }];
      (w[2] as { text: string }).text = ' ';
    });
    for (const t of ['unknown product "product.nope"', 'quantity must be a positive integer', 'customer effect "sellWish"', 'text must not be empty']) expect(has(e, t), t).toBe(true);
    expect(has(broken((p) => (npc(p).wishes = [])), 'shops but has no wishes')).toBe(true);
  });
});

describe('mutations: dialogues', () => {
  it('rejects an unknown start node, a dangling next and an unreachable node', () => {
    const e = broken((p) => {
      const d = dlg(p, 'dialogue.guenter.moin');
      d.start = 'zz';
      const x = dlg(p, 'dialogue.guenter.erstes-mal');
      (x.nodes.a?.options[0] as { next: string }).next = 'nope';
      x.nodes.island = { text: 'Hm.', options: [{ id: 'bye', text: 'Ok.' }] };
    });
    expect(has(e, 'start node "zz"')).toBe(true);
    expect(has(e, 'next node "nope"')).toBe(true);
    expect(has(e, 'node "island" is unreachable')).toBe(true);
  });

  it('rejects nodes without options, with too many or without an unconditional option', () => {
    const e = broken((p) => {
      const d = dlg(p, 'dialogue.guenter.moin');
      (d.nodes.knie as { options: unknown[] }).options = [];
      (d.nodes.strasse as { options: unknown[] }).options = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, text: 'x' }));
      (d.nodes.a as { options: unknown[] }).options = [{ id: 'x', text: 'y', when: [{ type: 'dayAtLeast', day: 2 }] }];
    });
    expect(has(e, 'needs 1-4 options (has 0)')).toBe(true);
    expect(has(e, 'needs 1-4 options (has 5)')).toBe(true);
    expect(has(e, 'needs at least one unconditional option')).toBe(true);
  });

  it('rejects unresolvable conditions', () => {
    const e = broken((p) => {
      dlg(p, 'dialogue.guenter.moin').when = [
        { type: 'flag', id: 'never.set' },
        { type: 'relationshipAtLeast', npcId: 'npc.ghost', value: 200 },
        { type: 'questStep', questId: 'quest.hof', step: 'zz' },
        { type: 'questOutcome', questId: 'quest.nope', outcome: 'a' },
        { type: 'seen', dialogueId: 'dialogue.nope' },
        { type: 'memory', npcId: 'npc.guenter', memoryId: 'never-remembered' },
        { type: 'time', from: 900, to: 800 },
        { type: 'weekday', days: [9] as never },
        { type: 'any', conditions: [] },
      ];
    });
    for (const t of ['flag "never.set" is read but never set', 'unknown resident "npc.ghost"', 'relationship threshold 200', 'has no step "zz"', 'unknown quest "quest.nope"', 'unknown dialogue "dialogue.nope"', 'never remembered', 'time window 900..800', 'weekday condition', '"any" needs']) {
      expect(has(e, t), t).toBe(true);
    }
  });

  it('rejects bad effects, large deltas and conflicting relationship keys', () => {
    const e = broken((p) => {
      const o = dlg(p, 'dialogue.guenter.moin').nodes.a?.options[1] as { effects: unknown[] };
      o.effects = [
        { type: 'relationship', npcId: 'npc.guenter', delta: 25, key: 'k.x' },
        { type: 'relationship', npcId: 'npc.derya', delta: 2, key: 'k.guenter.knie' },
        { type: 'remember', npcId: 'npc.ghost', memoryId: 'm' },
        { type: 'questStep', questId: 'quest.paket', step: 'zz' },
        { type: 'checkId' },
      ];
    });
    for (const t of ['delta 25', 'unknown resident "npc.ghost"', 'has no step "zz"', 'customer effect "checkId"', 'relationship key "k.guenter.knie" is used for different effects']) expect(has(e, t), t).toBe(true);
  });

  it('rejects contradictory outcomes and flags in one option', () => {
    const e = broken((p) => {
      const o = dlg(p, 'dialogue.derya.hof-entscheidung').nodes.a?.options[1] as { effects: unknown[] };
      o.effects.push({ type: 'questOutcome', questId: 'quest.hof', outcome: 'marlene' }, { type: 'setFlag', id: 'yard.bench', value: true }, { type: 'setFlag', id: 'yard.bench', value: false });
    });
    expect(has(e, 'contradictory outcomes "derya" and "marlene"')).toBe(true);
    expect(has(e, 'sets flag "yard.bench" to both true and false')).toBe(true);
  });

  it('rejects wrong ids, orphans and foreign dialogues', () => {
    expect(has(broken((p) => (dlg(p, 'dialogue.guenter.moin').id = 'guenter.moin')), 'does not match its id')).toBe(true);
    expect(has(broken((p) => (dlg(p, 'dialogue.guenter.moin').npcId = 'npc.derya')), 'belongs to "npc.derya"')).toBe(true);
    expect(has(broken((p) => (npc(p).dialogueIds = npc(p).dialogueIds.filter((d) => d !== 'dialogue.guenter.moin-abend'))), 'is not listed in the dialogueIds')).toBe(true);
    expect(has(broken((p) => npc(p).dialogueIds.push('dialogue.nope')), 'unknown dialogue "dialogue.nope"')).toBe(true);
  });

  it('rejects a resident whose only unconditional dialogue is once', () => {
    const e = broken((p) => {
      dlg(p, 'dialogue.jonas.moin').once = true;
    });
    expect(has(e, '"npc.jonas": needs an unconditional, non-once fallback')).toBe(true);
    expect(has(broken((p) => (dlg(p, 'dialogue.jonas.moin').when = [{ type: 'dayAtLeast', day: 2 }])), 'needs an unconditional, non-once fallback')).toBe(true);
  });
});

describe('mutations: quests, flags, customer lines', () => {
  it('rejects quests with unused steps or outcomes and too few steps', () => {
    const e = broken((p) => {
      const q = p.quests['quest.hof'] as ContentPack['quests'][string];
      q.steps.push({ id: 'extra', journal: 'x' });
      q.outcomes.push({ id: 'extra', journal: 'x' });
      (p.quests['quest.paket'] as ContentPack['quests'][string]).steps.length = 2;
    });
    expect(has(e, 'step "extra" is never set by an effect')).toBe(true);
    expect(has(e, 'outcome "extra" is never set by an effect')).toBe(true);
    expect(has(e, 'needs at least three steps')).toBe(true);
  });

  it('rejects a placement flag that no effect sets', () => {
    expect(has(broken((p) => ((p.layout.placements.find((x) => x.id === 'placement.yard-bench') as { requiresFlag: string }).requiresFlag = 'ghost.flag')), 'flag "ghost.flag" is read but never set')).toBe(true);
  });

  it('rejects incomplete customer lines', () => {
    const e = broken((p) => {
      p.customerLines.idChecked = 'Hier.';
      delete p.customerLines.failed.customer_underage;
      p.customerLines.sold = '';
    });
    expect(has(e, 'placeholder {age}')).toBe(true);
    expect(has(e, 'needs a line for "customer_underage"')).toBe(true);
    expect(has(e, 'customerLines.sold must not be empty')).toBe(true);
  });

  it('an empty pack (no residents, no nav) is valid', () => {
    expect(broken((p) => {
      p.npcs = {};
      p.dialogues = {};
      p.quests = {};
      p.layout.nav = { waypoints: [], edges: [], places: [] };
      p.layout.placements = p.layout.placements.filter((x) => !x.requiresFlag);
    })).toEqual([]);
  });
});
