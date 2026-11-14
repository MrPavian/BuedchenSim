import { WEATHER_CONDITIONS } from '../game/weather';
import { NPC_CLEARANCE_MARGIN, NPC_RADIUS, NPC_TALK_RADIUS, RELATIONSHIP_MAX, RELATIONSHIP_MIN } from '../game/balance';
import { PLAYER_RADIUS } from '../game/constants';
import { layoutColliders } from '../game/colliders';
import { distanceToSegment, navEdgeClear, navReachability } from '../game/nav';
import type { Condition, ContentPack, DialogueDef, Effect, NpcDef, PlaceKind, RoutineActivity, Vec2 } from '../game/types';

/**
 * Content rules of nav graph, residents, wishes, dialogues, quests and customer lines. Returns readable errors.
 * (Asset ids 'N-0xx' of the residents are not in the asset catalog, which only knows buildings, furniture, ground and products:
 * only the format is checked.)
 */

/** Where the player stands behind the counter when serving (between the shutter and the register points). */
export const COUNTER_STANDING_POINT: Vec2 = { x: -1.0, z: 0.95 };

const PLACE_KINDS: readonly PlaceKind[] = ['kiosk-window', 'sidewalk', 'yard', 'exit'];
const ACTIVITIES: readonly RoutineActivity[] = ['shop', 'visit', 'linger', 'pass-by'];
const DAY_START = 360;
const DAY_END = 1320;
const MAX_EFFECT_DELTA = 20;
const MAX_OPTIONS = 4;
const NPC_CLEARANCE = NPC_RADIUS * 2 + NPC_CLEARANCE_MARGIN;
const REQUIRED_FAILURES = ['insufficient_stock', 'kiosk_closed', 'customer_underage', 'age_check_required', 'day_not_open'];

const hasKey = (o: object, key: string): boolean => Object.hasOwn(o, key);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

function checkIds(kind: string, prefix: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id.startsWith(prefix)) errors.push(`${kind} id "${id}" must start with "${prefix}"`);
    if (seen.has(id)) errors.push(`duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

// --- Nav -------------------------------------------------------------------------------------------------------------

function validateNav(pack: ContentPack, errors: string[]): void {
  const { nav, walkBounds, kiosk } = pack.layout;
  checkIds('waypoint', 'wp.', nav.waypoints.map((w) => w.id), errors);
  checkIds('place', 'place.', nav.places.map((p) => p.id), errors);
  const pos = new Map(nav.waypoints.map((w) => [w.id, w.position]));
  for (const w of nav.waypoints) {
    const { x, z } = w.position;
    if (!Number.isFinite(x) || !Number.isFinite(z)) errors.push(`waypoint "${w.id}" has a non-finite position`);
    else if (x < walkBounds.minX || x > walkBounds.maxX || z < walkBounds.minZ || z > walkBounds.maxZ) {
      errors.push(`waypoint "${w.id}" is outside walkBounds`);
    }
  }

  const colliders = layoutColliders(pack.layout, pack.assets, false);
  const radius = Math.max(NPC_RADIUS, PLAYER_RADIUS);
  const edgeKeys = new Set<string>();
  const goodEdges: [string, string][] = [];
  for (const [a, b] of nav.edges) {
    const pa = pos.get(a);
    const pb = pos.get(b);
    if (!pa) errors.push(`edge ${a}-${b} references unknown waypoint "${a}"`);
    if (!pb) errors.push(`edge ${a}-${b} references unknown waypoint "${b}"`);
    if (!pa || !pb) continue;
    if (a === b) {
      errors.push(`edge ${a}-${b} connects a waypoint to itself`);
      continue;
    }
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (edgeKeys.has(key)) errors.push(`duplicate edge ${a}-${b}`);
    edgeKeys.add(key);
    goodEdges.push([a, b]);
    if (!navEdgeClear(pa, pb, colliders, radius)) errors.push(`edge ${a}-${b} is blocked by a collider (radius ${radius} m)`);
  }

  const exits = nav.places.filter((p) => p.kind === 'exit');
  if (exits.length < 2) errors.push('the nav graph needs at least two exits');
  const spotOwner = new Map<string, string>();
  for (const place of nav.places) {
    if (!PLACE_KINDS.includes(place.kind)) errors.push(`place "${place.id}" has unknown kind "${place.kind}"`);
    if (place.spots.length === 0) errors.push(`place "${place.id}" has no spots`);
    if (place.kind === 'exit' && place.spots.length !== 1) errors.push(`exit "${place.id}" must have exactly one spot`);
    for (const spot of place.spots) {
      if (!pos.has(spot.waypointId)) errors.push(`place "${place.id}" references unknown waypoint "${spot.waypointId}"`);
      if (!Number.isFinite(spot.heading)) errors.push(`place "${place.id}" has a non-finite heading`);
      const owner = spotOwner.get(spot.waypointId);
      if (owner !== undefined) errors.push(`waypoint "${spot.waypointId}" is a spot of both "${owner}" and "${place.id}"`);
      spotOwner.set(spot.waypointId, place.id);
    }
  }

  // Spots keep the NPC clearance to each other.
  const spotList = nav.places.flatMap((p) => p.spots.map((s) => ({ place: p.id, wp: s.waypointId, p: pos.get(s.waypointId) })));
  for (let i = 0; i < spotList.length; i += 1) {
    for (let j = i + 1; j < spotList.length; j += 1) {
      const a = spotList[i];
      const b = spotList[j];
      if (a?.p && b?.p && Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z) < NPC_CLEARANCE - 1e-9) {
        errors.push(`spots "${a.wp}" and "${b.wp}" are closer than the resident clearance ${NPC_CLEARANCE} m`);
      }
    }
  }

  // Places only used by pass-by routines are lane waypoints nobody stands on.
  const passByOnly = new Set<string>(nav.places.map((p) => p.id));
  for (const npc of Object.values(pack.npcs)) {
    for (const r of npc.routine) if (r.activity !== 'pass-by') passByOnly.delete(r.placeId);
  }
  for (const place of nav.places) {
    if (place.kind === 'exit' || (passByOnly.has(place.id) && Object.keys(pack.npcs).length > 0)) continue;
    for (const spot of place.spots) {
      const sp = pos.get(spot.waypointId);
      if (!sp) continue;
      for (const [a, b] of goodEdges) {
        if (a === spot.waypointId || b === spot.waypointId) continue;
        const pa = pos.get(a) as Vec2;
        const pb = pos.get(b) as Vec2;
        if (distanceToSegment(sp, pa, pb) < NPC_CLEARANCE - 1e-9) {
          errors.push(`spot "${spot.waypointId}" of "${place.id}" is closer than ${NPC_CLEARANCE} m to the lane ${a}-${b}`);
        }
      }
    }
  }

  // Kiosk window.
  const windows = nav.places.filter((p) => p.kind === 'kiosk-window');
  if (windows.length === 0) errors.push('the nav graph needs a kiosk-window place');
  for (const w of windows) {
    if (w.spots.length < 2) errors.push(`kiosk-window "${w.id}" needs at least two spots`);
    for (const spot of w.spots) {
      const sp = pos.get(spot.waypointId);
      if (sp && Math.hypot(sp.x - COUNTER_STANDING_POINT.x, sp.z - COUNTER_STANDING_POINT.z) > NPC_TALK_RADIUS) {
        errors.push(`spot "${spot.waypointId}" of "${w.id}" is further than ${NPC_TALK_RADIUS} m from the counter standing point`);
      }
    }
  }

  // The door approach stays free of standing spots.
  for (const o of kiosk.openings) {
    if (o.kind !== 'door' || o.side !== 'south') continue;
    const approach = { minX: o.from - NPC_CLEARANCE, maxX: o.to + NPC_CLEARANCE, minZ: kiosk.footprint.maxZ, maxZ: kiosk.footprint.maxZ + 1.2 + NPC_CLEARANCE };
    for (const s of spotList) {
      if (s.p && s.p.x > approach.minX && s.p.x < approach.maxX && s.p.z > approach.minZ && s.p.z < approach.maxZ) {
        errors.push(`spot "${s.wp}" lies in the approach of door "${o.id}"`);
      }
    }
  }

  // Reachability from every exit.
  for (const exit of exits) {
    const start = exit.spots[0]?.waypointId;
    if (start === undefined) continue;
    const reach = navReachability(nav, start);
    for (const id of reach.unreachable) errors.push(`waypoint "${id}" is not reachable from exit "${exit.id}"`);
  }
}

// --- Conditions and effects -------------------------------------------------------------------------------------------

interface Refs {
  pack: ContentPack;
  /** Flags that some effect sets. */
  flagsSet: Set<string>;
  /** Memories remembered by an effect: "npcId|memoryId". */
  memoriesSet: Set<string>;
}

function validateCondition(c: Condition, where: string, refs: Refs, errors: string[], flagsRead: Set<string>): void {
  const { pack } = refs;
  switch (c.type) {
    case 'flag':
      if (!nonEmpty(c.id)) errors.push(`${where}: flag condition needs an id`);
      else flagsRead.add(c.id);
      return;
    case 'relationshipAtLeast':
    case 'relationshipBelow':
      if (!hasKey(pack.npcs, c.npcId)) errors.push(`${where}: ${c.type} references unknown resident "${c.npcId}"`);
      if (!isInt(c.value) || c.value < RELATIONSHIP_MIN || c.value > RELATIONSHIP_MAX) errors.push(`${where}: relationship threshold ${c.value} must be an integer in 0..100`);
      return;
    case 'questStep': {
      const q = hasKey(pack.quests, c.questId) ? pack.quests[c.questId] : undefined;
      if (!q) errors.push(`${where}: questStep references unknown quest "${c.questId}"`);
      else if (!q.steps.some((s) => s.id === c.step)) errors.push(`${where}: quest "${c.questId}" has no step "${c.step}"`);
      return;
    }
    case 'questOutcome': {
      const q = hasKey(pack.quests, c.questId) ? pack.quests[c.questId] : undefined;
      if (!q) errors.push(`${where}: questOutcome references unknown quest "${c.questId}"`);
      else if (!q.outcomes.some((o) => o.id === c.outcome)) errors.push(`${where}: quest "${c.questId}" has no outcome "${c.outcome}"`);
      return;
    }
    case 'questNotStarted':
      if (!hasKey(pack.quests, c.questId)) errors.push(`${where}: questNotStarted references unknown quest "${c.questId}"`);
      return;
    case 'time':
      if (!isInt(c.from) || !isInt(c.to) || c.from < 0 || c.to > 1440 || c.from >= c.to) errors.push(`${where}: time window ${c.from}..${c.to} is invalid`);
      return;
    case 'weekday':
      if (c.days.length === 0 || c.days.some((d) => !isInt(d) || d < 0 || d > 6)) errors.push(`${where}: weekday condition needs weekdays 0..6`);
      return;
    case 'seen':
      if (!hasKey(pack.dialogues, c.dialogueId)) errors.push(`${where}: seen references unknown dialogue "${c.dialogueId}"`);
      return;
    case 'memory': {
      const npc = hasKey(pack.npcs, c.npcId) ? pack.npcs[c.npcId] : undefined;
      if (!npc) {
        errors.push(`${where}: memory references unknown resident "${c.npcId}"`);
        return;
      }
      const engine = /^(served|declined|ignored):(.+)$/.exec(c.memoryId);
      const engineOk = engine ? (npc.wishes ?? []).some((w) => w.id === engine[2]) : c.memoryId === 'kiosk-closed';
      if (!engineOk && !refs.memoriesSet.has(`${c.npcId}|${c.memoryId}`)) {
        errors.push(`${where}: memory "${c.memoryId}" of "${c.npcId}" is never remembered`);
      }
      return;
    }
    case 'dayAtLeast':
      if (!isInt(c.day) || c.day < 1) errors.push(`${where}: dayAtLeast needs an integer >= 1`);
      return;
    case 'weather':
      if (c.conditions.length === 0 || c.conditions.some((w) => !WEATHER_CONDITIONS.includes(w))) {
        errors.push(`${where}: weather needs known conditions (${WEATHER_CONDITIONS.join(', ')})`);
      }
      return;
    case 'temperatureAtLeast':
    case 'temperatureBelow':
      if (!Number.isFinite(c.value) || c.value < -30 || c.value > 50) errors.push(`${where}: ${c.type} needs a temperature in °C (-30..50)`);
      return;
    case 'season':
      if (c.seasons.length === 0 || c.seasons.some((x) => !['spring', 'summer', 'autumn', 'winter'].includes(x))) {
        errors.push(`${where}: season needs spring, summer, autumn or winter`);
      }
      return;
    case 'not':
      validateCondition(c.condition, where, refs, errors, flagsRead);
      return;
    case 'any':
      if (c.conditions.length === 0) errors.push(`${where}: "any" needs at least one condition`);
      for (const sub of c.conditions) validateCondition(sub, where, refs, errors, flagsRead);
      return;
    default:
      errors.push(`${where}: unknown condition type`);
  }
}

function validateEffect(e: Effect, where: string, refs: Refs, errors: string[], allowCustomer: boolean): void {
  const { pack } = refs;
  switch (e.type) {
    case 'relationship':
      if (!hasKey(pack.npcs, e.npcId)) errors.push(`${where}: relationship effect references unknown resident "${e.npcId}"`);
      if (!isInt(e.delta) || e.delta === 0 || Math.abs(e.delta) > MAX_EFFECT_DELTA) errors.push(`${where}: relationship delta ${e.delta} must be a non-zero integer, |delta| <= ${MAX_EFFECT_DELTA}`);
      if (!nonEmpty(e.key)) errors.push(`${where}: relationship effect needs a key`);
      return;
    case 'setFlag':
      if (!nonEmpty(e.id)) errors.push(`${where}: setFlag needs an id`);
      return;
    case 'remember':
      if (!hasKey(pack.npcs, e.npcId)) errors.push(`${where}: remember references unknown resident "${e.npcId}"`);
      if (!nonEmpty(e.memoryId)) errors.push(`${where}: remember needs a memoryId`);
      return;
    case 'questStep': {
      const q = hasKey(pack.quests, e.questId) ? pack.quests[e.questId] : undefined;
      if (!q) errors.push(`${where}: questStep effect references unknown quest "${e.questId}"`);
      else if (!q.steps.some((s) => s.id === e.step)) errors.push(`${where}: quest "${e.questId}" has no step "${e.step}"`);
      return;
    }
    case 'questOutcome': {
      const q = hasKey(pack.quests, e.questId) ? pack.quests[e.questId] : undefined;
      if (!q) errors.push(`${where}: questOutcome effect references unknown quest "${e.questId}"`);
      else if (!q.outcomes.some((o) => o.id === e.outcome)) errors.push(`${where}: quest "${e.questId}" has no outcome "${e.outcome}"`);
      return;
    }
    case 'sellWish':
    case 'declineWish':
    case 'checkId':
      if (!allowCustomer) errors.push(`${where}: customer effect "${e.type}" is not allowed in content dialogues or wish effects`);
      return;
    default:
      errors.push(`${where}: unknown effect type`);
  }
}

// --- Residents, wishes, routines -----------------------------------------------------------------------------------------

function demandTags(pack: ContentPack): Set<string> {
  return new Set(Object.values(pack.products).flatMap((p) => p.demandTags));
}

function checkLikes(pack: ContentPack, npc: NpcDef, kind: 'likes' | 'dislikes', tags: Set<string>, errors: string[]): void {
  for (const ref of npc[kind]) {
    if (ref.startsWith('tag:')) {
      if (!tags.has(ref.slice(4))) errors.push(`${npc.id}: ${kind} references unknown demand tag "${ref}"`);
    } else if (!hasKey(pack.products, ref)) errors.push(`${npc.id}: ${kind} references unknown product "${ref}"`);
  }
}

function validateNpc(pack: ContentPack, npc: NpcDef, refs: Refs, errors: string[], tags: Set<string>, flagsRead: Set<string>): void {
  const tag = `resident "${npc.id}"`;
  const nav = pack.layout.nav;
  if (!nonEmpty(npc.name) || !nonEmpty(npc.role) || !nonEmpty(npc.bio)) errors.push(`${tag}: name, role and bio must not be empty`);
  if (!isInt(npc.age) || npc.age < 0 || npc.age > 120) errors.push(`${tag}: age ${npc.age} must be an integer in 0..120`);
  if (!/^N-\d{3}$/.test(npc.assetId)) errors.push(`${tag}: assetId "${npc.assetId}" must look like N-0xx`);
  else if (npc.assetId === 'N-001') errors.push(`${tag}: N-001 is the player figure`);
  if (npc.personalityTags.length < 2 || npc.personalityTags.length > 4 || npc.personalityTags.some((t) => !nonEmpty(t))) {
    errors.push(`${tag}: needs 2-4 personality tags`);
  }
  if (!Number.isFinite(npc.walkSpeed) || npc.walkSpeed <= 0 || npc.walkSpeed > 3) errors.push(`${tag}: walkSpeed must be in (0, 3]`);
  if (!isInt(npc.startRelationship) || npc.startRelationship < RELATIONSHIP_MIN || npc.startRelationship > RELATIONSHIP_MAX) {
    errors.push(`${tag}: startRelationship must be an integer in 0..100`);
  }
  const home = nav.places.find((p) => p.id === npc.homeExitPlaceId);
  if (!home) errors.push(`${tag}: unknown homeExitPlaceId "${npc.homeExitPlaceId}"`);
  else if (home.kind !== 'exit') errors.push(`${tag}: homeExitPlaceId "${home.id}" is not an exit`);
  checkLikes(pack, npc, 'likes', tags, errors);
  checkLikes(pack, npc, 'dislikes', tags, errors);
  for (const l of npc.likes) if (npc.dislikes.includes(l)) errors.push(`${tag}: "${l}" is both liked and disliked`);
  for (const r of npc.relationships) {
    if (r.npcId === npc.id) errors.push(`${tag}: relationship to itself`);
    else if (!hasKey(pack.npcs, r.npcId)) errors.push(`${tag}: relationship references unknown resident "${r.npcId}"`);
    if (!nonEmpty(r.kind) || !nonEmpty(r.note)) errors.push(`${tag}: relationship to "${r.npcId}" needs kind and note`);
  }

  // Dialogue list.
  const listed = new Set<string>();
  for (const id of npc.dialogueIds) {
    if (listed.has(id)) errors.push(`${tag}: dialogue "${id}" is listed twice`);
    listed.add(id);
    const d = hasKey(pack.dialogues, id) ? pack.dialogues[id] : undefined;
    if (!d) errors.push(`${tag}: unknown dialogue "${id}"`);
    else if (d.npcId !== npc.id) errors.push(`${tag}: dialogue "${id}" belongs to "${d.npcId}"`);
  }
  const hasFallback = npc.dialogueIds.some((id) => {
    const d = hasKey(pack.dialogues, id) ? pack.dialogues[id] : undefined;
    return d !== undefined && d.once !== true && (d.when === undefined || d.when.length === 0);
  });
  if (!hasFallback) errors.push(`${tag}: needs an unconditional, non-once fallback dialogue`);

  // Routines.
  if (npc.routine.length === 0) errors.push(`${tag}: needs at least one routine entry`);
  const routineIds = new Set<string>();
  for (const r of npc.routine) {
    const where = `${tag} routine "${r.id}"`;
    if (routineIds.has(r.id)) errors.push(`${tag}: duplicate routine id "${r.id}"`);
    routineIds.add(r.id);
    if (r.weekdays.length === 0 || r.weekdays.some((d) => !isInt(d) || d < 0 || d > 6) || new Set(r.weekdays).size !== r.weekdays.length) {
      errors.push(`${where}: weekdays must be unique values 0..6`);
    }
    if (!isInt(r.from) || !isInt(r.to) || r.from < DAY_START || r.to > DAY_END || r.from >= r.to) {
      errors.push(`${where}: window ${r.from}..${r.to} must satisfy ${DAY_START} <= from < to <= ${DAY_END}`);
    }
    if (!ACTIVITIES.includes(r.activity)) errors.push(`${where}: unknown activity "${r.activity}"`);
    if (!Number.isFinite(r.chancePercent) || r.chancePercent < 0 || r.chancePercent > 100) errors.push(`${where}: chancePercent must be 0..100`);
    const place = nav.places.find((p) => p.id === r.placeId);
    if (!place) errors.push(`${where}: unknown place "${r.placeId}"`);
    else {
      if (r.activity === 'shop' && place.kind !== 'kiosk-window') errors.push(`${where}: shop is only possible at a kiosk-window place`);
      if (r.activity !== 'shop' && place.kind === 'kiosk-window') errors.push(`${where}: only shop may use the kiosk window`);
      if (place.kind === 'exit') errors.push(`${where}: place "${place.id}" is an exit`);
    }
    for (const c of r.when ?? []) validateCondition(c, where, refs, errors, flagsRead);
  }

  // Wishes.
  const wishes = npc.wishes ?? [];
  if (npc.routine.some((r) => r.activity === 'shop') && wishes.length === 0) errors.push(`${tag}: shops but has no wishes`);
  checkIds('wish', 'wish.', wishes.map((w) => w.id), errors);
  for (const w of wishes) {
    const where = `${tag} wish "${w.id}"`;
    if (w.lines.length === 0) errors.push(`${where}: has no lines`);
    for (const l of w.lines) {
      if (!hasKey(pack.products, l.productId)) errors.push(`${where}: unknown product "${l.productId}"`);
      if (!isInt(l.quantity) || l.quantity < 1) errors.push(`${where}: quantity must be a positive integer`);
    }
    if (!nonEmpty(w.text)) errors.push(`${where}: text must not be empty`);
    if (w.weight !== undefined && !(Number.isFinite(w.weight) && w.weight > 0)) errors.push(`${where}: weight must be positive`);
    for (const c of w.when ?? []) validateCondition(c, where, refs, errors, flagsRead);
    for (const e of [...(w.onSold ?? []), ...(w.onDeclined ?? [])]) validateEffect(e, where, refs, errors, false);
  }
}

// --- Dialogues -------------------------------------------------------------------------------------------------------------

function validateDialogue(d: DialogueDef, refs: Refs, errors: string[], flagsRead: Set<string>): void {
  const { pack } = refs;
  const tag = `dialogue "${d.id}"`;
  if (!hasKey(pack.npcs, d.npcId)) errors.push(`${tag}: unknown resident "${d.npcId}"`);
  else if (!(pack.npcs[d.npcId] as NpcDef).dialogueIds.includes(d.id)) errors.push(`${tag}: is not listed in the dialogueIds of "${d.npcId}"`);
  if (!isInt(d.priority)) errors.push(`${tag}: priority must be an integer`);
  if (!hasKey(d.nodes, d.start)) errors.push(`${tag}: start node "${d.start}" does not exist`);
  for (const c of d.when ?? []) validateCondition(c, tag, refs, errors, flagsRead);

  const reached = new Set<string>();
  const queue = hasKey(d.nodes, d.start) ? [d.start] : [];
  while (queue.length > 0) {
    const id = queue.pop() as string;
    if (reached.has(id)) continue;
    reached.add(id);
    for (const o of d.nodes[id]?.options ?? []) if (o.next !== undefined && hasKey(d.nodes, o.next)) queue.push(o.next);
  }
  for (const [id, node] of Object.entries(d.nodes)) {
    const where = `${tag} node "${id}"`;
    if (!reached.has(id)) errors.push(`${where} is unreachable`);
    if (!nonEmpty(node.text)) errors.push(`${where}: text must not be empty`);
    if (node.options.length < 1 || node.options.length > MAX_OPTIONS) errors.push(`${where}: needs 1-${MAX_OPTIONS} options (has ${node.options.length})`);
    if (!node.options.some((o) => o.when === undefined || o.when.length === 0)) errors.push(`${where}: needs at least one unconditional option`);
    const optionIds = new Set<string>();
    for (const o of node.options) {
      const ow = `${where} option "${o.id}"`;
      if (optionIds.has(o.id)) errors.push(`${where}: duplicate option id "${o.id}"`);
      optionIds.add(o.id);
      if (!nonEmpty(o.text)) errors.push(`${ow}: text must not be empty`);
      if (o.next !== undefined && !hasKey(d.nodes, o.next)) errors.push(`${ow}: next node "${o.next}" does not exist`);
      for (const c of o.when ?? []) validateCondition(c, ow, refs, errors, flagsRead);
      for (const e of o.effects ?? []) validateEffect(e, ow, refs, errors, false);
      // Contradictions inside one option.
      const outcomes = new Map<string, string>();
      const flags = new Map<string, boolean>();
      for (const e of o.effects ?? []) {
        if (e.type === 'questOutcome') {
          const prev = outcomes.get(e.questId);
          if (prev !== undefined && prev !== e.outcome) errors.push(`${ow}: sets contradictory outcomes "${prev}" and "${e.outcome}" of "${e.questId}"`);
          outcomes.set(e.questId, e.outcome);
        } else if (e.type === 'setFlag') {
          const prev = flags.get(e.id);
          if (prev !== undefined && prev !== e.value) errors.push(`${ow}: sets flag "${e.id}" to both true and false`);
          flags.set(e.id, e.value);
        }
      }
    }
  }
}

function collectEffects(pack: ContentPack): Effect[] {
  const out: Effect[] = [];
  for (const d of Object.values(pack.dialogues)) {
    for (const n of Object.values(d.nodes)) for (const o of n.options) out.push(...(o.effects ?? []));
  }
  for (const npc of Object.values(pack.npcs)) for (const w of npc.wishes ?? []) out.push(...(w.onSold ?? []), ...(w.onDeclined ?? []));
  return out;
}

function validateQuests(pack: ContentPack, effects: Effect[], errors: string[]): void {
  checkIds('quest', 'quest.', Object.keys(pack.quests), errors);
  for (const [key, q] of Object.entries(pack.quests)) {
    const tag = `quest "${key}"`;
    if (q.id !== key) errors.push(`${tag}: key does not match id "${q.id}"`);
    if (!nonEmpty(q.title)) errors.push(`${tag}: title must not be empty`);
    if (q.steps.length < 3) errors.push(`${tag}: needs at least three steps`);
    if (q.outcomes.length < 2) errors.push(`${tag}: needs at least two outcomes`);
    for (const list of [q.steps, q.outcomes]) {
      const ids = new Set<string>();
      for (const s of list) {
        if (!nonEmpty(s.id) || !nonEmpty(s.journal)) errors.push(`${tag}: steps and outcomes need an id and a journal text`);
        if (ids.has(s.id)) errors.push(`${tag}: duplicate id "${s.id}"`);
        ids.add(s.id);
      }
    }
    for (const s of q.steps) {
      if (!effects.some((e) => e.type === 'questStep' && e.questId === key && e.step === s.id)) errors.push(`${tag}: step "${s.id}" is never set by an effect`);
    }
    for (const o of q.outcomes) {
      if (!effects.some((e) => e.type === 'questOutcome' && e.questId === key && e.outcome === o.id)) errors.push(`${tag}: outcome "${o.id}" is never set by an effect`);
    }
  }
}

function validateCustomerLines(pack: ContentPack, errors: string[]): void {
  const l = pack.customerLines;
  for (const k of ['sell', 'checkId', 'decline', 'close', 'idChecked', 'sold', 'declined', 'failedFallback'] as const) {
    if (!nonEmpty(l[k])) errors.push(`customerLines.${k} must not be empty`);
  }
  if (!l.idChecked.includes('{age}')) errors.push('customerLines.idChecked must contain the placeholder {age}');
  for (const reason of REQUIRED_FAILURES) if (!nonEmpty(l.failed[reason])) errors.push(`customerLines.failed needs a line for "${reason}"`);
  for (const [reason, text] of Object.entries(l.failed)) if (!nonEmpty(text)) errors.push(`customerLines.failed.${reason} must not be empty`);
}

/** Nav, residents, dialogues, quests and customer lines of a pack; empty when the pack has none of them. */
export function validateResidents(pack: ContentPack): string[] {
  const errors: string[] = [];
  const nav = pack.layout.nav;
  const npcs = Object.values(pack.npcs);
  if (npcs.length === 0 && nav.waypoints.length === 0 && Object.keys(pack.dialogues).length === 0 && Object.keys(pack.quests).length === 0) {
    return errors;
  }

  validateNav(pack, errors);

  checkIds('resident', 'npc.', Object.values(pack.npcs).map((n) => n.id), errors);
  for (const [key, npc] of Object.entries(pack.npcs)) if (npc.id !== key) errors.push(`resident key "${key}" does not match its id "${npc.id}"`);
  const assetUsers = new Map<string, string>();
  for (const npc of npcs) {
    const other = assetUsers.get(npc.assetId);
    if (other !== undefined) errors.push(`residents "${other}" and "${npc.id}" share the figure asset "${npc.assetId}"`);
    assetUsers.set(npc.assetId, npc.id);
  }
  checkIds('dialogue', 'dialogue.', Object.values(pack.dialogues).map((d) => d.id), errors);
  for (const [key, d] of Object.entries(pack.dialogues)) if (d.id !== key) errors.push(`dialogue key "${key}" does not match its id "${d.id}"`);

  const effects = collectEffects(pack);
  const refs: Refs = {
    pack,
    flagsSet: new Set(effects.flatMap((e) => (e.type === 'setFlag' && e.value ? [e.id] : []))),
    memoriesSet: new Set(effects.flatMap((e) => (e.type === 'remember' ? [`${e.npcId}|${e.memoryId}`] : []))),
  };
  const flagsRead = new Set<string>();
  const tags = demandTags(pack);

  for (const npc of npcs) validateNpc(pack, npc, refs, errors, tags, flagsRead);
  for (const d of Object.values(pack.dialogues)) validateDialogue(d, refs, errors, flagsRead);
  for (const p of pack.layout.placements) if (p.requiresFlag !== undefined) flagsRead.add(p.requiresFlag);
  for (const f of flagsRead) if (!refs.flagsSet.has(f)) errors.push(`flag "${f}" is read but never set to true by an effect`);

  // Relationship keys: one key always means the same effect (resident and delta).
  const keys = new Map<string, string>();
  for (const e of effects) {
    if (e.type !== 'relationship') continue;
    const sig = `${e.npcId}:${e.delta}`;
    const prev = keys.get(e.key);
    if (prev !== undefined && prev !== sig) errors.push(`relationship key "${e.key}" is used for different effects (${prev} and ${sig})`);
    keys.set(e.key, sig);
  }

  validateQuests(pack, effects, errors);
  validateCustomerLines(pack, errors);
  return errors;
}
