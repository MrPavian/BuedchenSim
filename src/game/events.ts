import type { GameSpeed } from './balance';
import type { AvailableInteraction, InteractionTarget } from './interaction';
import type { RelationshipTier } from './relationship';
import type { DayPhase, NpcStatus } from './state';
import type { InteractionKind } from './types';

export type GameEvents = {
  'kiosk.door.changed': { open: boolean };
  'kiosk.shutter.changed': { open: boolean };
  /** The kiosk-point interaction in range changed; null while a resident is targeted (a resident wins over kiosk points). */
  'interaction.available.changed': { interaction: AvailableInteraction | null };
  /** The target of `interact()` (resident or kiosk point) changed. */
  'interaction.target.changed': { target: InteractionTarget | null };
  /** A register/storage point was used; the UI opens the matching panel. No state changed. */
  'interaction.triggered': { pointId: string; kind: InteractionKind };
  /** After load/reset; views must resync (state, kiosk, interaction prompt). */
  'game.state.replaced': Record<string, never>;
  /** Pause, speed or phase changed (never emitted per tick). */
  'calendar.changed': { paused: boolean; speed: GameSpeed; phase: DayPhase };
  /** 22:00 was reached; the day waits for `economy.closeDay()`. Emitted once per day. */
  'day.ending': { day: number };
  'day.ended': { day: number };
  'day.started': { day: number };
  /** Storage or shelf quantity of a product changed. */
  'product.stock.changed': { productId: string };
  'money.changed': { cashCents: number };
  /** `npcId` is present when a resident customer bought the goods. */
  'sale.completed': { transactionId: number; totalCents: number; npcId?: string };
  'order.placed': { totalCents: number };
  'delivery.received': { totalCents: number };
  /** A resident changed its status (appeared, walks, waits, stands, talks, left). Never emitted per tick. */
  'npc.status.changed': { npcId: string; status: NpcStatus };
  /** A customer expressed a wish and waits for service. */
  'npc.wish': { npcId: string; wishId: string };
  /** `dialogueId` is the content dialogue id, or the built-in customer dialogue id. */
  'dialogue.opened': { npcId: string; dialogueId: string };
  'dialogue.closed': { npcId: string };
  'relationship.changed': { npcId: string; value: number; tier: RelationshipTier };
  /** A story flag or the progress (step or outcome) of a quest changed. */
  'story.changed': { questId?: string; flag?: string };
  'memory.added': { npcId: string; memoryId: string };
};
