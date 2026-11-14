import {
  NPC_BLOCKED_WAIT_SECONDS,
  NPC_CLEARANCE_MARGIN,
  NPC_DEADLOCK_SECONDS,
  NPC_MAX_STEP_SECONDS,
  NPC_MAX_TICK_SECONDS,
  NPC_RADIUS,
  SHUTTER_PATIENCE_MINUTES,
} from './balance';
import { conditionsHold } from './conditions';
import { PLAYER_RADIUS } from './constants';
import type { DomainContext } from './domain';
import {
  buildNavGraph,
  edgeOrigin,
  findPath,
  nearestWaypoint,
  pathLength,
  type NavGraph,
} from './nav';
import type { NpcDef, PlaceDef, RoutineEntry } from './npcTypes';
import { roll } from './random';
import { weekdayOf } from './selectors';
import type { NpcState, NpcStatus } from './state';
import { addMemory } from './story';
import { pickWish } from './wishes';
import { NEUTRAL_DEMAND, demandContextOf, routineChance, wishDemandFactor } from './demand';

/** Absolute game minute: `day * 1440 + minute`. */
export function absoluteMinute(day: number, minute: number): number {
  return day * 1440 + minute;
}

export interface NpcSim {
  /** One simulation step of `dtSeconds` real seconds (scaled by the clock speed); frozen while paused. */
  tick(dtSeconds: number): void;
  /**
   * The resident finishes its routine and walks home (the resolved or abandoned customer). Keeps the status
   * 'talking' during a conversation. An unresolved wish is dropped with the memory 'ignored:<wishId>'.
   */
  leave(npcId: string, memoryId?: string): void;
  /** Status after a conversation: walking while it has a route, else waiting (open wish) or at_place. */
  endTalk(npcId: string): void;
  /** Clears the runtime caches (after load/reset). */
  reset(): void;
}

interface Runtime {
  /** Seconds blocked since the last wait period / since the last move. */
  blockedFor: number;
  /** Seconds blocked continuously (only reset by moving). */
  blockedTotal: number;
  /** Deadlock fallback active: walks through other residents until none is near any more. */
  ghost: boolean;
  blocker: string | null;
  rollDay: number;
  rolls: Map<string, boolean>;
}

const PLAYER_BLOCKER = '\u0000player';
const ARRIVE_EPSILON = 1e-9;

export function createNpcSim(ctx: DomainContext): NpcSim {
  const { content } = ctx;
  const nav = content.layout.nav;
  const graph: NavGraph = buildNavGraph(nav);
  const places = new Map<string, PlaceDef>(nav.places.map((p) => [p.id, p]));
  const exits = nav.places.filter((p) => p.kind === 'exit');
  const ids = Object.keys(content.npcs).sort();
  const runtimes = new Map<string, Runtime>();
  const playerClearance = PLAYER_RADIUS + NPC_RADIUS + NPC_CLEARANCE_MARGIN;
  const npcClearance = NPC_RADIUS * 2 + NPC_CLEARANCE_MARGIN;

  const runtimeOf = (id: string): Runtime => {
    let rt = runtimes.get(id);
    if (!rt) {
      rt = { blockedFor: 0, blockedTotal: 0, ghost: false, blocker: null, rollDay: -1, rolls: new Map() };
      runtimes.set(id, rt);
    }
    return rt;
  };

  const setStatus = (id: string, npc: NpcState, status: NpcStatus): void => {
    if (npc.status === status) return;
    npc.status = status;
    ctx.emit('npc.status.changed', { npcId: id, status });
  };

  const waypointPos = (id: string): { x: number; z: number } | undefined => graph.positions.get(id);
  const exitWaypoint = (place: PlaceDef | undefined): string | null => place?.spots[0]?.waypointId ?? null;
  const entryOf = (def: NpcDef, routineId: string | null): RoutineEntry | undefined =>
    routineId === null ? undefined : def.routine.find((r) => r.id === routineId);

  const doneIds = (npc: NpcState, day: number): string[] => {
    if (npc.doneToday.day !== day) {
      npc.doneToday.day = day;
      npc.doneToday.routineIds.length = 0;
    }
    return npc.doneToday.routineIds;
  };

  // --- Routine choice ---------------------------------------------------------------------------------------------

  /** First entry (list order) of today's window that is not done, whose conditions hold and whose daily roll passed. */
  const pickRoutine = (id: string, def: NpcDef, npc: NpcState): RoutineEntry | null => {
    const state = ctx.state();
    const { day, minute } = state.calendar;
    const weekday = weekdayOf(day);
    const done = doneIds(npc, day);
    const rt = runtimeOf(id);
    const cond = { ...state, env: ctx.env() };
    if (rt.rollDay !== day) {
      rt.rollDay = day;
      rt.rolls.clear();
    }
    for (const entry of def.routine) {
      if (minute < entry.from || minute >= entry.to) continue;
      if (!entry.weekdays.includes(weekday)) continue;
      if (done.includes(entry.id)) continue;
      if (!conditionsHold(entry.when, cond)) continue;
      let passed = rt.rolls.get(entry.id);
      if (passed === undefined) {
        // The chance includes event visitors and the resident's weather response (Auftrag 05); rolled once per day.
        passed = roll(state.world.seed, day, id, 'routine', entry.id) * 100 < routineChance(entry, def, cond.env, content.events);
        rt.rolls.set(entry.id, passed);
      }
      if (passed) return entry;
    }
    return null;
  };

  // --- Bodies -----------------------------------------------------------------------------------------------------

  /** Another body within clearance of the point (used for appearing). */
  const bodyNear = (selfId: string, x: number, z: number): boolean => {
    const state = ctx.state();
    const p = state.player.position;
    if ((p.x - x) ** 2 + (p.z - z) ** 2 < playerClearance ** 2) return true;
    for (const other of ids) {
      if (other === selfId) continue;
      const o = state.npcs[other];
      if (!o || o.status === 'away') continue;
      if ((o.position.x - x) ** 2 + (o.position.z - z) ** 2 < npcClearance ** 2) return true;
    }
    return false;
  };

  /** Another resident within clearance of the point. */
  const npcBodyNear = (selfId: string, x: number, z: number): boolean => {
    const npcs = ctx.state().npcs;
    for (const other of ids) {
      if (other === selfId) continue;
      const o = npcs[other];
      if (o && o.status !== 'away' && (o.position.x - x) ** 2 + (o.position.z - z) ** 2 < npcClearance ** 2) return true;
    }
    return false;
  };

  /** The body that stops a move from (ox,oz) to (nx,nz): only moves that get closer within clearance are blocked. */
  const blockerOf = (
    selfId: string,
    ox: number,
    oz: number,
    nx: number,
    nz: number,
    ignoreNpcs: boolean,
  ): string | null => {
    const state = ctx.state();
    const p = state.player.position;
    const dNewP = (p.x - nx) ** 2 + (p.z - nz) ** 2;
    if (dNewP < playerClearance ** 2 && dNewP < (p.x - ox) ** 2 + (p.z - oz) ** 2) return PLAYER_BLOCKER;
    if (ignoreNpcs) return null;
    for (const other of ids) {
      if (other === selfId) continue;
      const o = state.npcs[other];
      if (!o || o.status === 'away') continue;
      const dNew = (o.position.x - nx) ** 2 + (o.position.z - nz) ** 2;
      if (dNew < npcClearance ** 2 && dNew < (o.position.x - ox) ** 2 + (o.position.z - oz) ** 2) return other;
    }
    return null;
  };

  const freeSpot = (selfId: string, place: PlaceDef): number | null => {
    const npcs = ctx.state().npcs;
    for (let i = 0; i < place.spots.length; i += 1) {
      let taken = false;
      for (const other of ids) {
        if (other === selfId) continue;
        const o = npcs[other];
        if (o && o.status !== 'away' && o.placeId === place.id && o.spotIndex === i) {
          taken = true;
          break;
        }
      }
      if (!taken) return i;
    }
    return null;
  };

  // --- Routes -----------------------------------------------------------------------------------------------------

  /** Drops the first waypoint when the resident already stands on it (and is not walking toward it). */
  const routeFor = (npc: NpcState, path: string[]): string[] => {
    const first = path[0] ? waypointPos(path[0]) : undefined;
    if (npc.route.length === 0 && first && Math.hypot(first.x - npc.position.x, first.z - npc.position.z) < 1e-6) {
      return path.slice(1);
    }
    return path.slice();
  };

  const startNode = (npc: NpcState): string | null =>
    npc.route.length > 0 ? (npc.route[0] as string) : nearestWaypoint(graph, npc.position);

  /** Exit to walk to: the home exit, else the reachable exit with the shortest way. */
  const exitPlan = (def: NpcDef, from: string): { place: PlaceDef; path: string[] } | null => {
    const home = places.get(def.homeExitPlaceId);
    const homeWp = exitWaypoint(home);
    if (home && homeWp) {
      const path = findPath(graph, from, homeWp);
      if (path) return { place: home, path };
    }
    let best: { place: PlaceDef; path: string[] } | null = null;
    let bestLen = Infinity;
    for (const exit of exits) {
      const wp = exitWaypoint(exit);
      const path = wp ? findPath(graph, from, wp) : null;
      if (!path) continue;
      const len = pathLength(graph, path);
      if (len < bestLen) {
        bestLen = len;
        best = { place: exit, path };
      }
    }
    return best;
  };

  // --- Status changes ---------------------------------------------------------------------------------------------

  const becomeAway = (id: string, npc: NpcState): void => {
    const state = ctx.state();
    if (npc.routineId !== null) doneIds(npc, state.calendar.day).push(npc.routineId);
    npc.routineId = null;
    npc.placeId = null;
    npc.spotIndex = null;
    npc.route.length = 0;
    npc.wish = null;
    npc.waitingSince = null;
    setStatus(id, npc, 'away');
  };

  const arrive = (id: string, def: NpcDef, npc: NpcState): void => {
    const state = ctx.state();
    const place = npc.placeId === null ? undefined : places.get(npc.placeId);
    if (!place || place.kind === 'exit') {
      becomeAway(id, npc);
      return;
    }
    const spot = npc.spotIndex === null ? undefined : place.spots[npc.spotIndex];
    if (spot) npc.heading = spot.heading;
    setStatus(id, npc, 'at_place');
    npc.lastVisit = { day: state.calendar.day, minute: Math.floor(state.calendar.minute) };
    // Visiting while an event is on leaves a memory (once per event kind; Auftrag 05, 5.6).
    const env = ctx.env();
    for (const eventId of env.activeEvents) {
      const memory = (content.events ?? []).find((e) => e.id === eventId)?.memory;
      if (memory) addMemory(ctx, id, memory);
    }
    const entry = entryOf(def, npc.routineId);
    if (entry?.activity === 'shop' && place.kind === 'kiosk-window') {
      npc.waitingSince = absoluteMinute(state.calendar.day, state.calendar.minute);
    }
  };

  const leave = (id: string, memoryId?: string): void => {
    const state = ctx.state();
    const def = Object.hasOwn(content.npcs, id) ? content.npcs[id] : undefined;
    const npc = Object.hasOwn(state.npcs, id) ? state.npcs[id] : undefined;
    if (!def || !npc || npc.status === 'away') return;
    if (memoryId) addMemory(ctx, id, memoryId);
    if (npc.wish && npc.wish.resolved === null) {
      addMemory(ctx, id, `ignored:${npc.wish.wishId}`);
      npc.wish = null;
    }
    if (npc.routineId !== null) doneIds(npc, state.calendar.day).push(npc.routineId);
    npc.routineId = null;
    npc.spotIndex = null;
    npc.waitingSince = null;
    const from = startNode(npc);
    const plan = from === null ? null : exitPlan(def, from);
    if (!plan) {
      // No way home in the graph (content validation prevents this): the resident simply disappears.
      if (npc.status === 'talking') npc.route.length = 0;
      else becomeAway(id, npc);
      return;
    }
    npc.placeId = plan.place.id;
    npc.route = routeFor(npc, plan.path);
    runtimeOf(id).blockedFor = 0;
    if (npc.status === 'talking') return;
    if (npc.route.length === 0) {
      arrive(id, def, npc);
    } else {
      setStatus(id, npc, 'walking');
    }
  };

  const endTalk = (id: string): void => {
    const npc = Object.hasOwn(ctx.state().npcs, id) ? ctx.state().npcs[id] : undefined;
    if (!npc || npc.status !== 'talking') return;
    if (npc.route.length > 0) setStatus(id, npc, 'walking');
    else if (npc.wish && npc.wish.resolved === null) setStatus(id, npc, 'waiting');
    else setStatus(id, npc, 'at_place');
  };

  // --- Starting a routine -----------------------------------------------------------------------------------------

  /** Appears at the home exit and starts walking; false when the entry cannot start now (no spot, no way, exit crowded). */
  const startRoutine = (id: string, def: NpcDef, npc: NpcState, entry: RoutineEntry): boolean => {
    const place = places.get(entry.placeId);
    const home = places.get(def.homeExitPlaceId);
    const homeWp = exitWaypoint(home);
    const homePos = homeWp ? waypointPos(homeWp) : undefined;
    if (!place || !homeWp || !homePos) return false;
    let route: string[] | null;
    let target: PlaceDef = place;
    let spotIndex: number | null = null;
    if (entry.activity === 'pass-by') {
      const through = exitWaypoint(place) ?? place.spots[0]?.waypointId;
      if (!through) return false;
      const first = findPath(graph, homeWp, through);
      if (!first) return false;
      let dest: { place: PlaceDef; path: string[] } | null = null;
      let destLen = Infinity;
      for (const exit of exits) {
        const wp = exitWaypoint(exit);
        if (!wp || exit.id === home?.id) continue;
        const path = findPath(graph, through, wp);
        const len = path ? pathLength(graph, path) : Infinity;
        if (path && len < destLen) {
          dest = { place: exit, path };
          destLen = len;
        }
      }
      dest ??= exitPlan(def, through);
      if (!dest) return false;
      target = dest.place;
      route = [...first, ...dest.path.slice(1)];
    } else {
      spotIndex = place.kind === 'exit' ? null : freeSpot(id, place);
      if (place.kind !== 'exit' && spotIndex === null) return false;
      const wp = spotIndex === null ? exitWaypoint(place) : place.spots[spotIndex]?.waypointId;
      route = wp ? findPath(graph, homeWp, wp) : null;
    }
    if (!route) return false;
    if (bodyNear(id, homePos.x, homePos.z)) return false;

    npc.position.x = homePos.x;
    npc.position.z = homePos.z;
    npc.placeId = target.id;
    npc.spotIndex = spotIndex;
    npc.routineId = entry.id;
    npc.route = route.slice(1);
    npc.wish = null;
    npc.waitingSince = null;
    runtimeOf(id).blockedFor = 0;
    const next = npc.route[0] ? waypointPos(npc.route[0]) : undefined;
    if (next) npc.heading = Math.atan2(next.x - homePos.x, next.z - homePos.z);
    if (npc.route.length === 0) arrive(id, def, npc);
    else setStatus(id, npc, 'walking');
    return true;
  };

  // --- Walking ----------------------------------------------------------------------------------------------------

  /** Turn back and take another route that avoids the edge it is on; false when there is none. */
  const tryAlternativeRoute = (id: string, npc: NpcState): boolean => {
    const next = npc.route[0];
    const dest = npc.route[npc.route.length - 1];
    if (next === undefined || dest === undefined) return false;
    const origin = edgeOrigin(graph, npc.position, next);
    if (origin === null) return false;
    const path = findPath(graph, origin, dest, [origin, next]);
    if (!path) return false;
    npc.route = path;
    const rt = runtimeOf(id);
    rt.blockedFor = 0;
    rt.blockedTotal = 0;
    return true;
  };

  const stepWalking = (id: string, def: NpcDef, npc: NpcState, scaled: number): void => {
    const rt = runtimeOf(id);
    let remaining = def.walkSpeed * scaled;
    let blockedNow: string | null = null;
    while (remaining > ARRIVE_EPSILON && npc.route.length > 0) {
      const target = waypointPos(npc.route[0] as string);
      if (!target) {
        npc.route.shift();
        continue;
      }
      const dx = target.x - npc.position.x;
      const dz = target.z - npc.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= ARRIVE_EPSILON) {
        npc.route.shift();
        continue;
      }
      npc.heading = Math.atan2(dx, dz);
      const move = Math.min(remaining, dist);
      const nx = move >= dist ? target.x : npc.position.x + (dx / dist) * move;
      const nz = move >= dist ? target.z : npc.position.z + (dz / dist) * move;
      blockedNow = blockerOf(id, npc.position.x, npc.position.z, nx, nz, rt.ghost);
      if (blockedNow !== null) break;
      npc.position.x = nx;
      npc.position.z = nz;
      remaining -= move;
      if (move >= dist) npc.route.shift();
    }
    if (blockedNow !== null) {
      rt.blocker = blockedNow;
      rt.blockedFor += scaled;
      rt.blockedTotal += scaled;
      if (rt.blockedFor >= NPC_BLOCKED_WAIT_SECONDS) {
        // The player or a resident that cannot give way is waited out by looking for another route; between two
        // walking residents the one with the higher id gives way (the lower id has priority).
        const other = blockedNow === PLAYER_BLOCKER ? undefined : ctx.state().npcs[blockedNow];
        const yields = other === undefined || other.status !== 'walking' || id > blockedNow;
        if (yields && tryAlternativeRoute(id, npc)) return;
        rt.blockedFor = 0; // try again after the next wait period
        if (yields && other !== undefined && rt.blockedTotal >= NPC_DEADLOCK_SECONDS) rt.ghost = true;
      }
      return;
    }
    rt.blockedFor = 0;
    rt.blockedTotal = 0;
    rt.blocker = null;
    if (rt.ghost && !npcBodyNear(id, npc.position.x, npc.position.z)) rt.ghost = false;
    if (npc.route.length === 0) arrive(id, def, npc);
  };

  // --- Per resident -----------------------------------------------------------------------------------------------

  const updateNpc = (id: string, def: NpcDef, npc: NpcState, scaled: number): void => {
    const state = ctx.state();
    const { calendar } = state;
    const open = calendar.phase === 'open';

    if (npc.status === 'away') {
      if (!open) return;
      const entry = pickRoutine(id, def, npc);
      if (entry) startRoutine(id, def, npc, entry);
      return;
    }

    const entry = entryOf(def, npc.routineId);
    if (npc.routineId !== null) {
      // Leaves when its window ended or the day phase is no longer 'open'. A pass-by walk is finished instead.
      const finished = !entry || !open || calendar.minute >= entry.to;
      if (finished && entry?.activity !== 'pass-by') {
        leave(id);
        if ((npc.status as NpcStatus) !== 'walking') return;
      }
    }

    if (npc.status === 'walking') {
      stepWalking(id, def, npc, scaled);
      return;
    }

    // at_place / waiting
    if (npc.routineId === null) {
      leave(id); // e.g. after a conversation that found no way home
      return;
    }
    if (entry?.activity !== 'shop' || npc.status !== 'at_place' || npc.wish !== null) return;
    const place = npc.placeId === null ? undefined : places.get(npc.placeId);
    if (place?.kind !== 'kiosk-window') return;
    const now = absoluteMinute(calendar.day, calendar.minute);
    if (state.kiosk.shutterOpen && open) {
      const env = ctx.env();
      const demandCtx = demandContextOf(env, calendar.minute, content.events);
      const demand = content.demand ?? NEUTRAL_DEMAND;
      const wish = pickWish(def, { ...state, env }, state.world.seed, entry.id, (w) =>
        wishDemandFactor(
          w.lines.map((l) => content.products[l.productId]).filter((p) => p !== undefined),
          demand,
          demandCtx,
        ),
      );
      if (!wish) {
        leave(id);
        return;
      }
      npc.wish = { wishId: wish.id, lines: wish.lines.map((l) => ({ ...l })), ageChecked: false, resolved: null };
      npc.waitingSince = now;
      setStatus(id, npc, 'waiting');
      ctx.emit('npc.wish', { npcId: id, wishId: wish.id });
    } else if (npc.waitingSince !== null && now - npc.waitingSince >= SHUTTER_PATIENCE_MINUTES) {
      leave(id, 'kiosk-closed');
    }
  };

  const simStep = (scaled: number): void => {
    const state = ctx.state();
    for (const id of ids) {
      const npc = state.npcs[id];
      const def = content.npcs[id];
      if (!npc || !def || npc.status === 'talking') continue;
      updateNpc(id, def, npc, scaled);
    }
  };

  return {
    tick(dtSeconds) {
      if (!Number.isFinite(dtSeconds) || dtSeconds <= 0 || ids.length === 0) return;
      const { calendar } = ctx.state();
      if (calendar.paused) return;
      // A single tick never simulates more than NPC_MAX_TICK_SECONDS of walking: the game loop sends 1/60 s, and a
      // huge dt (tests, a stalled tab) must not freeze the game in millions of sub-steps. Routines catch up by time.
      const total = Math.min(dtSeconds, NPC_MAX_TICK_SECONDS) * calendar.speed;
      const steps = Math.max(1, Math.ceil(total / (NPC_MAX_STEP_SECONDS * calendar.speed)));
      const each = total / steps;
      for (let i = 0; i < steps; i += 1) simStep(each);
    },
    leave,
    endTalk,
    reset() {
      runtimes.clear();
    },
  };
}
