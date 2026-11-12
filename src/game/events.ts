import type { GameSpeed } from './balance';
import type { AvailableInteraction } from './interaction';
import type { DayPhase } from './state';
import type { InteractionKind } from './types';

export type GameEvents = {
  'kiosk.door.changed': { open: boolean };
  'kiosk.shutter.changed': { open: boolean };
  'interaction.available.changed': { interaction: AvailableInteraction | null };
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
  'sale.completed': { transactionId: number; totalCents: number };
  'order.placed': { totalCents: number };
  'delivery.received': { totalCents: number };
};
