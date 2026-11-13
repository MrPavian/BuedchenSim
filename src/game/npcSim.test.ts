import { describe, expect, it } from 'vitest';
import { NPC_CLEARANCE_MARGIN, NPC_RADIUS, SHUTTER_PATIENCE_MINUTES } from './balance';
import { PLAYER_RADIUS } from './constants';
import { createGame, type Game } from './game';
import { distanceToSegment } from './nav';
import { roll } from './random';
import type { NpcState } from './state';
import { testPack } from './testing/fixture-pack';
import { FAR_AWAY, mutable, newGame, openShutter, run, runUntil, setFlag, setTime } from './testing/harness';
import type { ContentPack, NpcDef } from './types';

const STAMM = 'npc.stammkunde';
const KURIER = 'npc.kurier';
const NACH = 'npc.nachbarin';

/** The fixture pack without the routines of the given residents (so they do not crowd the scene under test). */
function quiet(...ids: string[]): ContentPack {
  const pack: ContentPack = structuredClone(testPack);
  for (const id of ids) (pack.npcs[id] as NpcDef).routine = [];
  return pack;
}

const npc = (game: Game, id: string): NpcState => mutable(game).npcs[id] as NpcState;
const pos = (game: Game, id: string) => ({ ...npc(game, id).position });
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Sets the time and ticks once (so the resident decides for exactly this minute). */
function at(game: Game, minute: number, day = 1): void {
  setTime(game, minute, day);
  game.tick(1 / 60);
}

describe('routines at time and weekday boundaries', () => {
  it('starts exactly at the window start (inclusive) and not a moment before', () => {
    const game = newGame();
    at(game, 539.9);
    expect(npc(game, KURIER).status).toBe('away');
    at(game, 540);
    expect(npc(game, KURIER).status).toBe('walking');
    expect(npc(game, KURIER).routineId).toBe('r.shop');
    expect(npc(game, KURIER).placeId).toBe('place.window');
    expect(pos(game, KURIER).x).toBeLessThan(-9.9); // appeared at the home exit (west)
  });

  it('does not start when the window is over (exclusive end) or on the wrong weekday', () => {
    const game = newGame();
    at(game, 600); // the regular's morning window is [480, 600)
    expect(npc(game, STAMM).status).toBe('away');
    const last = newGame();
    at(last, 599.9);
    expect(npc(last, STAMM).status).toBe('walking');
    const friday = newGame();
    at(friday, 730, 5); // Friday: the weekend yard routine of the regular is not active, the neighbour visits
    expect(npc(friday, STAMM).status).toBe('away');
    expect(npc(friday, NACH).status).toBe('walking');
    const weekend = newGame();
    at(weekend, 730, 6); // Saturday
    expect(npc(weekend, NACH).status).toBe('away');
    expect(npc(weekend, STAMM).status).toBe('walking');
    expect(npc(weekend, STAMM).placeId).toBe('place.yard');
  });

  it('uses the weekday derived from the day counter (day 8 is a Monday again)', () => {
    const game = newGame();
    at(game, 730, 8);
    expect(npc(game, NACH).status).toBe('walking');
  });

  it('keeps residents out of the world while the phase is not open', () => {
    const game = newGame();
    setTime(game, 480);
    mutable(game).calendar.phase = 'awaiting_close';
    run(game, 2);
    expect(npc(game, STAMM).status).toBe('away');
    mutable(game).calendar.phase = 'closed';
    run(game, 2);
    expect(npc(game, STAMM).status).toBe('away');
  });

  it('honours the conditions of a routine entry', () => {
    const pack: ContentPack = structuredClone(testPack);
    const def = pack.npcs[KURIER] as NpcDef;
    const entry = def.routine[0];
    if (entry) entry.when = [{ type: 'flag', id: 'test.go' }];
    const game = newGame(7, pack);
    at(game, 560);
    expect(npc(game, KURIER).status).toBe('away');
    setFlag(game, 'test.go');
    game.tick(1 / 60);
    expect(npc(game, KURIER).status).toBe('walking');
  });
});

describe('deterministic decisions', () => {
  const expectedToday = (seed: number, day: number): boolean => roll(seed, day, STAMM, 'routine', 'r.maybe-sidewalk') * 100 < 50;

  it('the chance roll of a day is the same for the same seed and day, and follows the documented key', () => {
    const seed = 99;
    for (let day = 1; day <= 14; day += 1) {
      const game = newGame(seed);
      at(game, 905, day);
      const appeared = npc(game, STAMM).status !== 'away' && npc(game, STAMM).routineId === 'r.maybe-sidewalk';
      expect(appeared).toBe(expectedToday(seed, day));
      const again = newGame(seed);
      at(again, 905, day);
      expect(npc(again, STAMM).status).toBe(npc(game, STAMM).status);
    }
  });

  it('both outcomes occur over a few days and another seed decides differently somewhere', () => {
    const outcomes = (seed: number) => Array.from({ length: 20 }, (_, i) => expectedToday(seed, i + 1));
    expect(outcomes(1).includes(true) && outcomes(1).includes(false)).toBe(true);
    expect(outcomes(1)).not.toEqual(outcomes(2));
  });

  it('a reload in the middle of the day changes nothing', () => {
    // (Runtime wait timers are not saved, so the scene has nobody blocked at the moment of the reload.)
    const pack = quiet(NACH);
    const a = newGame(31, pack);
    setTime(a, 478);
    run(a, 4); // 480: the regular starts walking
    run(a, 20);
    const b = createGame(pack, structuredClone(mutable(a)));
    b.player.setPose(FAR_AWAY, 0);
    run(a, 60);
    run(b, 60);
    expect(mutable(b).npcs).toEqual(mutable(a).npcs);
  });

  it('a full simulated day gives identical results for identical seeds', () => {
    const play = (): unknown => {
      const game = newGame(5);
      setTime(game, 400);
      mutable(game).calendar.speed = 4;
      openShutter(game);
      run(game, 600);
      return [mutable(game).npcs, mutable(game).story];
    };
    expect(play()).toEqual(play());
  });
});

describe('walking, states and spots', () => {
  it('goes away -> walking -> at_place -> waiting -> walking -> away and reports each change once', () => {
    const game = newGame();
    const changes: string[] = [];
    game.signals.on('npc.status.changed', (p) => {
      if (p.npcId === STAMM) changes.push(p.status);
    });
    setTime(game, 479.5);
    openShutter(game);
    // walk time: about 17 m at 1.4 m/s; the window of the shop routine ends at 10:00
    expect(runUntil(game, () => npc(game, STAMM).status === 'waiting', 120)).toBe(true);
    expect(npc(game, STAMM).wish?.wishId).toBe('wish.water');
    expect(npc(game, STAMM).placeId).toBe('place.window');
    expect(npc(game, STAMM).spotIndex).toBe(0);
    expect(pos(game, STAMM)).toEqual({ x: -1.6, z: 2.55 });
    expect(npc(game, STAMM).heading).toBeCloseTo(Math.PI);
    expect(npc(game, STAMM).lastVisit).toEqual({ day: 1, minute: expect.any(Number) });

    expect(runUntil(game, () => npc(game, STAMM).status === 'away', 900)).toBe(true);
    expect(changes).toEqual(['walking', 'at_place', 'waiting', 'walking', 'away']);
    const done = npc(game, STAMM);
    expect(done.wish).toBeNull();
    expect(done.routineId).toBeNull();
    expect(done.placeId).toBeNull();
    expect(done.memories).toContain('ignored:wish.water');
    expect(done.doneToday).toEqual({ day: 1, routineIds: ['r.morning-shop'] });
    expect(pos(game, STAMM).x).toBeGreaterThan(9.9); // left through its home exit
  });

  it('does not repeat a finished routine the same day, but starts the next day fresh', () => {
    const game = newGame(7, quiet(NACH));
    setTime(game, 590);
    openShutter(game);
    run(game, 1);
    expect(npc(game, STAMM).status).toBe('walking');
    expect(runUntil(game, () => npc(game, STAMM).status === 'away', 200)).toBe(true);
    setTime(game, 595);
    game.tick(1 / 60);
    expect(npc(game, STAMM).status).toBe('away'); // r.morning-shop is done (and its window is closing)
    at(game, 485, 2);
    expect(npc(game, STAMM).status).toBe('walking');
  });

  it('a customer at the window without an open shutter waits, then leaves with a memory (once)', () => {
    const game = newGame();
    setTime(game, 480);
    expect(runUntil(game, () => npc(game, STAMM).status === 'at_place', 120)).toBe(true);
    expect(npc(game, STAMM).wish).toBeNull();
    const since = npc(game, STAMM).waitingSince as number;
    expect(since).toBeGreaterThanOrEqual(1 * 1440 + 480);
    // the patience runs in game minutes
    const minutes = (): number => game.state.calendar.day * 1440 + game.state.calendar.minute;
    expect(runUntil(game, () => minutes() - since >= SHUTTER_PATIENCE_MINUTES - 1, 3000)).toBe(true);
    expect(npc(game, STAMM).status).toBe('at_place');
    expect(runUntil(game, () => npc(game, STAMM).status === 'walking', 200)).toBe(true);
    expect(npc(game, STAMM).memories).toEqual(['kiosk-closed']);
    expect(runUntil(game, () => npc(game, STAMM).status === 'away', 200)).toBe(true);
    run(game, 30);
    expect(npc(game, STAMM).status).toBe('away'); // done for the day: no second attempt
    expect(npc(game, STAMM).memories).toEqual(['kiosk-closed']);
    expect(npc(game, STAMM).relationship).toBe(30); // no relationship farming
  });

  it('chooses the wish when the shutter opens during the patience time', () => {
    const game = newGame();
    setTime(game, 480);
    expect(runUntil(game, () => npc(game, STAMM).status === 'at_place', 120)).toBe(true);
    run(game, 5);
    expect(npc(game, STAMM).status).toBe('at_place');
    const wishes: string[] = [];
    game.signals.on('npc.wish', (p) => wishes.push(`${p.npcId}:${p.wishId}`));
    openShutter(game);
    run(game, 1);
    expect(npc(game, STAMM).status).toBe('waiting');
    expect(wishes).toEqual([`${STAMM}:wish.water`]);
  });

  it('two customers take different spots; a third finds none and stays away until one is free', () => {
    const pack: ContentPack = structuredClone(testPack);
    pack.npcs['npc.dritter'] = {
      ...(structuredClone(pack.npcs[KURIER]) as NpcDef),
      id: 'npc.dritter',
      assetId: 'N-099',
      dialogueIds: [],
      homeExitPlaceId: 'place.exit-east',
      routine: [{ id: 'r.shop', weekdays: [0, 1, 2, 3, 4, 5, 6], from: 480, to: 720, activity: 'shop', placeId: 'place.window', chancePercent: 100 }],
    };
    const game = newGame(7, pack);
    openShutter(game);
    setTime(game, 480);
    const third = 'npc.dritter';
    expect(runUntil(game, () => npc(game, STAMM).status === 'waiting' && npc(game, third).status === 'waiting', 200)).toBe(true);
    expect(npc(game, STAMM).spotIndex).not.toBe(npc(game, third).spotIndex);
    expect(dist(pos(game, STAMM), pos(game, third))).toBeGreaterThan(1);
    // the kurier starts at 09:00 (540): both spots are taken
    expect(runUntil(game, () => game.state.calendar.minute >= 545, 400)).toBe(true);
    expect(npc(game, KURIER).status).toBe('away');
    // the regular leaves at 10:00 (600) -> the spot frees and the kurier gets it
    expect(runUntil(game, () => npc(game, KURIER).status !== 'away', 3600)).toBe(true);
    expect(npc(game, KURIER).placeId).toBe('place.window');
  });

  it('pass-by walks from its exit through the place to another exit and is done for the day', () => {
    const game = newGame();
    const visited = new Set<string>();
    setTime(game, 419.5);
    for (let i = 0; i < 60 * 60 && !(i > 100 && npc(game, NACH).status === 'away'); i += 1) {
      game.tick(1 / 60);
      const p = pos(game, NACH);
      for (const wp of testPack.layout.nav.waypoints) if (dist(p, wp.position) < 0.03) visited.add(wp.id);
    }
    expect(npc(game, NACH).status).toBe('away');
    expect(visited.has('wp.side-a')).toBe(true); // through the sidewalk place
    expect(visited.has('wp.exit-east')).toBe(true); // out through the other exit
    expect(pos(game, NACH).x).toBeGreaterThan(9.9);
    expect(npc(game, NACH).doneToday.routineIds).toEqual(['r.pass']);
  });

  it('a spot is a standing point: residents never overlap while a whole day runs, and stay on the edges', () => {
    const game = newGame(3);
    openShutter(game);
    setTime(game, 400);
    mutable(game).calendar.speed = 4;
    const nav = testPack.layout.nav;
    const point = (id: string) => nav.waypoints.find((w) => w.id === id)?.position as { x: number; z: number };
    let minGap = Infinity;
    let seen = 0;
    for (let i = 0; i < 60 * 330; i += 1) {
      game.tick(1 / 60);
      const visible = Object.values(mutable(game).npcs).filter((n) => n.status !== 'away');
      for (const n of visible) {
        seen += 1;
        const onEdge = nav.edges.some(([a, b]) => distanceToSegment(n.position, point(a), point(b)) < 1e-6);
        expect(onEdge, `${n.status} at ${n.position.x},${n.position.z}`).toBe(true);
      }
      for (let a = 0; a < visible.length; a += 1) {
        for (let b = a + 1; b < visible.length; b += 1) {
          minGap = Math.min(minGap, dist((visible[a] as NpcState).position, (visible[b] as NpcState).position));
        }
      }
    }
    expect(seen).toBeGreaterThan(1000);
    expect(minGap).toBeGreaterThanOrEqual(NPC_RADIUS * 2 - 1e-6);
  });
});

describe('time: pause, speed, phases', () => {
  it('pause freezes the residents; resume continues; speed scales the movement', () => {
    const game = newGame();
    setTime(game, 479.9);
    run(game, 0.5); // on the first, straight segment from the east exit
    const moving = pos(game, STAMM);
    expect(moving.x).toBeLessThan(10);
    game.calendar.pause();
    run(game, 5);
    expect(pos(game, STAMM)).toEqual(moving);
    game.calendar.resume();
    run(game, 0.5);
    expect(dist(pos(game, STAMM), moving)).toBeCloseTo(0.7, 1);
    game.calendar.setSpeed(4);
    const before = pos(game, STAMM);
    run(game, 0.5);
    expect(dist(pos(game, STAMM), before)).toBeCloseTo(1.4 * 4 * 0.5, 1);
  });

  it('awaiting_close and closed send everyone home (also those still on their way)', () => {
    for (const phase of ['awaiting_close', 'closed'] as const) {
      const game = newGame();
      openShutter(game);
      setTime(game, 730, 6); // Saturday: the regular lingers in the yard, the courier shops
      expect(runUntil(game, () => npc(game, STAMM).status === 'at_place', 200)).toBe(true);
      const kurierStart = newGame();
      void kurierStart;
      setTime(game, 735, 6);
      mutable(game).calendar.phase = phase;
      expect(runUntil(game, () => npc(game, STAMM).status === 'away', 200)).toBe(true);
      expect(Object.values(mutable(game).npcs).every((n) => n.status === 'away')).toBe(true);
    }
  });

  it('a resident on its way to a place turns back to the exit when the day ends', () => {
    const game = newGame();
    setTime(game, 482);
    run(game, 3);
    expect(npc(game, STAMM).status).toBe('walking');
    expect(npc(game, STAMM).routineId).toBe('r.morning-shop');
    mutable(game).calendar.phase = 'awaiting_close';
    game.tick(1 / 60);
    expect(npc(game, STAMM).routineId).toBeNull();
    expect(npc(game, STAMM).placeId).toBe('place.exit-east');
    expect(runUntil(game, () => npc(game, STAMM).status === 'away', 200)).toBe(true);
  });

  it('the next day starts after the day was closed and residents appear again', () => {
    const game = newGame();
    setTime(game, 700, 1);
    mutable(game).calendar.phase = 'awaiting_close';
    game.economy.closeDay();
    expect(game.calendar.startNextDay()).toEqual({ ok: true });
    game.tick(1 / 60);
    setTime(game, 481, game.state.calendar.day);
    game.tick(1 / 60);
    expect(npc(game, STAMM).status).toBe('walking');
  });
});

describe('blocking by the player and by other residents', () => {
  /** Distance of the first resident that must reach the window (the courier) to the player, every tick. */
  function watchMinGap(game: Game, id: string, seconds: number): number {
    let min = Infinity;
    for (let i = 0; i < seconds * 60; i += 1) {
      game.tick(1 / 60);
      if (npc(game, id).status !== 'away') min = Math.min(min, dist(pos(game, id), game.state.player.position));
    }
    return min;
  }

  it('stops in front of the player on its edge and never gets closer than the clearance (no passing, no teleport)', () => {
    const game = newGame(7, quiet(STAMM, NACH));
    openShutter(game);
    game.player.setPose({ x: -4.25, z: 3.6 }, 0); // on the edge w1-w2, but away from the bypass
    setTime(game, 539.9);
    const clearance = PLAYER_RADIUS + NPC_RADIUS;
    const gap = watchMinGap(game, KURIER, 3.5); // shorter than the wait time: it just stops
    expect(gap).toBeGreaterThanOrEqual(clearance - 1e-9);
    expect(gap).toBeLessThan(clearance + NPC_CLEARANCE_MARGIN + 0.1);
    expect(npc(game, KURIER).status).toBe('walking');
    const stopped = pos(game, KURIER);
    run(game, 0.3);
    expect(dist(pos(game, KURIER), stopped)).toBeLessThan(0.05);
  });

  it('takes the bypass after the wait time, avoiding the blocked edge', () => {
    const game = newGame(7, quiet(STAMM, NACH));
    openShutter(game);
    game.player.setPose({ x: -4.25, z: 3.6 }, 0);
    setTime(game, 539.9);
    let maxZ = -Infinity;
    let minGap = Infinity;
    for (let i = 0; i < 60 * 40; i += 1) {
      game.tick(1 / 60);
      if (npc(game, KURIER).status === 'away') continue;
      maxZ = Math.max(maxZ, pos(game, KURIER).z);
      minGap = Math.min(minGap, dist(pos(game, KURIER), game.state.player.position));
    }
    expect(maxZ).toBeGreaterThan(4.3); // went around via wp.b1
    expect(minGap).toBeGreaterThanOrEqual(PLAYER_RADIUS + NPC_RADIUS - 1e-9);
    expect(['waiting', 'at_place']).toContain(npc(game, KURIER).status);
    expect(npc(game, KURIER).placeId).toBe('place.window');
  });

  it('waits as long as the player stands on its only way, and continues when the player leaves', () => {
    const game = newGame(7, quiet(STAMM, NACH));
    openShutter(game);
    game.player.setPose({ x: -1.6, z: 2.55 }, 0); // on the first window spot, which is a dead end of the graph
    setTime(game, 539.9);
    // the courier targets spot 0 (wp.win-a); the player stands on it
    run(game, 40);
    expect(npc(game, KURIER).status).toBe('walking');
    expect(dist(pos(game, KURIER), game.state.player.position)).toBeGreaterThanOrEqual(PLAYER_RADIUS + NPC_RADIUS - 1e-9);
    game.player.setPose(FAR_AWAY, 0);
    expect(runUntil(game, () => npc(game, KURIER).status === 'waiting', 60)).toBe(true);
    expect(npc(game, KURIER).spotIndex).toBe(0);
  });

  it('a resident does not appear while the player stands on its exit', () => {
    const game = newGame();
    game.player.setPose({ x: -10, z: 3.6 }, 0);
    setTime(game, 539.9);
    run(game, 5);
    expect(npc(game, KURIER).status).toBe('away');
    game.player.setPose(FAR_AWAY, 0);
    run(game, 1);
    expect(npc(game, KURIER).status).toBe('walking');
  });

  it('between two walking residents on one lane the higher id gives way after the deadlock time (never the player)', () => {
    // A lane without a bypass: the courier walks west->east towards the yard while the neighbour walks east->west.
    const pack: ContentPack = structuredClone(testPack);
    pack.layout.nav.edges = pack.layout.nav.edges.filter(([a, b]) => a !== 'wp.b1' && b !== 'wp.b1');
    pack.layout.nav.waypoints = pack.layout.nav.waypoints.filter((w) => w.id !== 'wp.b1');
    (pack.npcs[STAMM] as NpcDef).routine = [];
    const kurier = pack.npcs[KURIER] as NpcDef;
    kurier.routine = [{ id: 'r.shop', weekdays: [0, 1, 2, 3, 4, 5, 6], from: 540, to: 720, activity: 'visit', placeId: 'place.yard', chancePercent: 100 }];
    const nach = pack.npcs[NACH] as NpcDef;
    nach.homeExitPlaceId = 'place.exit-east';
    nach.dialogueIds = [];
    nach.routine = [{ id: 'r.pass', weekdays: [0, 1, 2, 3, 4, 5, 6], from: 540, to: 600, activity: 'pass-by', placeId: 'place.sidewalk', chancePercent: 100 }];
    // The neighbour passes through wp.side-a and then walks west: meets the courier head-on between w1 and w3.
    const game = newGame(7, pack);
    setTime(game, 539.9);
    let minGap = Infinity;
    let ghosted = false;
    for (let i = 0; i < 60 * 150; i += 1) {
      game.tick(1 / 60);
      if (npc(game, KURIER).status !== 'away' && npc(game, NACH).status !== 'away') {
        const gap = dist(pos(game, KURIER), pos(game, NACH));
        minGap = Math.min(minGap, gap);
        if (gap < NPC_RADIUS * 2) ghosted = true;
      }
    }
    expect(ghosted).toBe(true); // the last resort was needed on this single lane (the lower priority walked through)
    // both made it: the courier reached the yard, the neighbour left through the west exit
    expect(npc(game, KURIER).status).toBe('at_place');
    expect(npc(game, KURIER).placeId).toBe('place.yard');
    expect(npc(game, NACH).status).toBe('away');
    expect(minGap).toBeLessThan(NPC_RADIUS * 2);
  });
});
