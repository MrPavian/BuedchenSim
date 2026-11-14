import type { Season } from './date';
import type { Weekday } from './selectors';
import type { WeatherCondition } from './weather';
import type { Vec2 } from './types';

/**
 * Content contracts of phase 4: navigation, residents, wishes, dialogues, quests.
 * Pure data; the only behaviour lives in `conditions.ts`, `story.ts` and the simulation. No code in data.
 */

// --- Navigation -------------------------------------------------------------------------------------------------

export interface WaypointDef {
  /** Prefix 'wp.'. */
  id: string;
  position: Vec2;
}

export type PlaceKind = 'kiosk-window' | 'sidewalk' | 'yard' | 'exit';

export interface PlaceSpotDef {
  waypointId: string;
  /** Heading (radians, 0 = +Z, positive toward +X) a resident faces while standing here. */
  heading: number;
}

export interface PlaceDef {
  /** Prefix 'place.'. */
  id: string;
  kind: PlaceKind;
  /** Several standing spots, so residents never stand on the same point. An exit is where residents appear/disappear. */
  spots: PlaceSpotDef[];
}

export interface NavDef {
  waypoints: WaypointDef[];
  /** Undirected edges by waypoint id. */
  edges: [string, string][];
  places: PlaceDef[];
}

// --- Conditions and effects ---------------------------------------------------------------------------------------

export type Condition =
  | { type: 'flag'; id: string; value?: boolean }
  | { type: 'relationshipAtLeast'; npcId: string; value: number }
  | { type: 'relationshipBelow'; npcId: string; value: number }
  | { type: 'questStep'; questId: string; step: string }
  | { type: 'questOutcome'; questId: string; outcome: string }
  | { type: 'questNotStarted'; questId: string }
  /** Minutes since midnight, `from` inclusive, `to` exclusive. */
  | { type: 'time'; from: number; to: number }
  | { type: 'weekday'; days: Weekday[] }
  | { type: 'seen'; dialogueId: string }
  | { type: 'memory'; npcId: string; memoryId: string }
  | { type: 'dayAtLeast'; day: number }
  /** Today's weather is one of these (Auftrag 05). */
  | { type: 'weather'; conditions: WeatherCondition[] }
  /** The current temperature (°C) is at least / below the value. */
  | { type: 'temperatureAtLeast'; value: number }
  | { type: 'temperatureBelow'; value: number }
  | { type: 'season'; seasons: Season[] }
  /** The event is active right now (within its hours). */
  | { type: 'eventActive'; eventId: string }
  /** The event takes place today (before, during or after its hours). */
  | { type: 'eventToday'; eventId: string }
  | { type: 'not'; condition: Condition }
  | { type: 'any'; conditions: Condition[] };

export type Effect =
  /** `key` makes the change happen at most once ever (stored in story.effectKeys). The result is clamped to 0..100. */
  | { type: 'relationship'; npcId: string; delta: number; key: string }
  | { type: 'setFlag'; id: string; value: boolean }
  /** Adds the memory to the resident once. */
  | { type: 'remember'; npcId: string; memoryId: string }
  /** Moves forward only (to a step later in QuestDef.steps); ignored otherwise or after an outcome. */
  | { type: 'questStep'; questId: string; step: string }
  /** Final: ignored when the quest already has an outcome. */
  | { type: 'questOutcome'; questId: string; outcome: string }
  /** Customer effects: act on the open wish of the resident being talked to. */
  | { type: 'sellWish' }
  | { type: 'declineWish' }
  | { type: 'checkId' };

// --- Dialogues and quests -----------------------------------------------------------------------------------------

export interface DialogueOption {
  /** Unique within its node. */
  id: string;
  text: string;
  when?: Condition[];
  effects?: Effect[];
  /** Node id; absent = the dialogue ends. */
  next?: string;
}

export interface DialogueNode {
  text: string;
  options: DialogueOption[];
}

export interface DialogueDef {
  /** Prefix 'dialogue.'. */
  id: string;
  npcId: string;
  /** Higher first. */
  priority: number;
  when?: Condition[];
  /** Offered only until it has been seen once. */
  once?: boolean;
  /** Id of the first node. */
  start: string;
  nodes: Record<string, DialogueNode>;
}

export interface QuestDef {
  /** Prefix 'quest.'. */
  id: string;
  title: string;
  /** Ordered: steps only move forward. */
  steps: { id: string; journal: string }[];
  outcomes: { id: string; journal: string }[];
}

// --- Residents ----------------------------------------------------------------------------------------------------

export type RoutineActivity = 'shop' | 'visit' | 'linger' | 'pass-by';

export interface RoutineEntry {
  id: string;
  weekdays: Weekday[];
  /** Game minutes since midnight (360..1320); `from` inclusive, `to` exclusive. */
  from: number;
  to: number;
  activity: RoutineActivity;
  /** 'shop' at a kiosk-window place makes the resident a customer; 'pass-by' walks from its exit through the place to another exit. */
  placeId: string;
  /** 0..100, one deterministic roll per day. */
  chancePercent: number;
  when?: Condition[];
}

export interface WishLine {
  productId: string;
  quantity: number;
}

export interface WishDef {
  /** Prefix 'wish.'. */
  id: string;
  lines: WishLine[];
  when?: Condition[];
  /** What the resident says (content text). */
  text: string;
  /** Relative weight of the deterministic roll (default 1). */
  weight?: number;
  /** Content effects after a successful sale / a decline (no customer effects). */
  onSold?: Effect[];
  onDeclined?: Effect[];
}

export interface NpcRelationshipDef {
  npcId: string;
  kind: string;
  note: string;
}

export interface NpcDef {
  /** Prefix 'npc.'. */
  id: string;
  name: string;
  age: number;
  role: string;
  bio: string;
  /** Register id 'N-0xx'. */
  assetId: string;
  personalityTags: string[];
  /** Metres per second at clock speed 1. */
  walkSpeed: number;
  /** 0..100. */
  startRelationship: number;
  homeExitPlaceId: string;
  routine: RoutineEntry[];
  /** Product ids or 'tag:<demandTag>'. */
  likes: string[];
  dislikes: string[];
  relationships: NpcRelationshipDef[];
  dialogueIds: string[];
  wishes?: WishDef[];
}

/**
 * Generic lines of the built-in customer dialogue (all content text). `idChecked` may contain the placeholder
 * `{age}`, replaced by the resident's age. `failed` is keyed by the rejection reason of the sale
 * (e.g. 'insufficient_stock', 'customer_underage', 'age_check_required', 'kiosk_closed'); other reasons use `failedFallback`.
 */
export interface CustomerLines {
  sell: string;
  checkId: string;
  decline: string;
  close: string;
  idChecked: string;
  sold: string;
  declined: string;
  failed: Record<string, string>;
  failedFallback: string;
}
