/** Pure formatting helpers (DOM-free, integer math only). */

function wholeNumber(value: number): number {
  return Number.isFinite(value) ? Math.round(value) : 0;
}

/** Integer cents -> "12,50 €" (German decimal comma, dot as thousands separator). */
export function formatEuro(cents: number): string {
  const total = wholeNumber(cents);
  const sign = total < 0 ? '-' : '';
  const abs = Math.abs(total);
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped},${String(rest).padStart(2, '0')} €`;
}

/** Like formatEuro but with an explicit "+" for positive amounts (profit/cash flow lines). */
export function formatEuroSigned(cents: number): string {
  const text = formatEuro(cents);
  return wholeNumber(cents) > 0 ? `+${text}` : text;
}

/** Minutes since midnight (may be fractional) -> "06:05"; whole minutes only, wraps at 24 h. */
export function formatClock(minute: number): string {
  const whole = Math.max(0, Math.floor(Number.isFinite(minute) ? minute : 0));
  const hours = Math.floor(whole / 60) % 24;
  return `${String(hours).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
}
