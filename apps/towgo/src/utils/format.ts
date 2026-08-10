/** "10 mins", "1 min". */
export const formatEta = (minutes: number): string => `${minutes} min${minutes === 1 ? '' : 's'}`;

/**
 * Indian-grouped rupee amount, e.g. 1250 → "₹1,250", 100000 → "₹1,00,000".
 * Manual grouping — Hermes' Intl/toLocaleString support is unreliable.
 */
export function formatINR(amount: number): string {
  const digits = Math.round(amount).toString();
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
  return `₹${grouped}`;
}

/**
 * Integer paise → "₹1,250" (whole rupees) or "₹1,250.50" (fractional) — the
 * wire-money formatter (spec §14, `packages/api-contracts`'s `paiseSchema`).
 * Named `formatPaise`, not `formatINR`: that name is already taken by the
 * rupee-number formatter above, which several booking screens call today —
 * reusing it for a paise input would silently misformat every existing caller
 * by 100x. Mirrors `apps/towfleet-web/src/lib/money.ts`'s whole/fractional
 * split, with the same manual-grouping approach as `formatINR` above.
 */
export function formatPaise(paise: number): string {
  const rupees = paise / 100;
  if (paise % 100 === 0) return formatINR(rupees);

  const sign = rupees < 0 ? '-' : '';
  const abs = Math.abs(paise);
  const whole = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  return `${sign}${formatINR(whole)}.${cents}`;
}

/**
 * Shift a 12-hour clock label by N minutes, e.g. ("4:20 PM", 55) → "5:15 PM".
 *
 * Booking payloads carry a pickup label and a duration, not a drop timestamp,
 * so the details screen derives the arrival time rather than inventing a field.
 * Returns the input unchanged if it isn't a recognisable "h:mm AM/PM".
 */
export function addMinutesToTimeLabel(time: string, minutes: number): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim());
  if (!match) return time;

  const [, rawHour, rawMinute, meridiem] = match;
  const hour12 = Number(rawHour) % 12;
  const base = (meridiem.toUpperCase() === 'PM' ? hour12 + 12 : hour12) * 60 + Number(rawMinute);
  const shifted = ((base + minutes) % 1440 + 1440) % 1440;

  const hour24 = Math.floor(shifted / 60);
  const displayHour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const displayMinute = String(shifted % 60).padStart(2, '0');
  return `${displayHour}:${displayMinute} ${hour24 < 12 ? 'AM' : 'PM'}`;
}
