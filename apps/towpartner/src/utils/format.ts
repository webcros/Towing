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

/** "8" → "08"; keeps 2+ digit values as-is. */
export const pad2 = (n: number): string => n.toString().padStart(2, '0');

/** mm:ss countdown, e.g. 165 → "02:45". */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

/** "+12.5%" / "-3%" — signed, one decimal only when needed. */
export function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  const body = Number.isInteger(abs) ? `${abs}` : abs.toFixed(1);
  return `${sign}${body}%`;
}

/**
 * A short "how long ago" label for the notification centre, e.g. "12m", "3h",
 * "2d", then an absolute date past a week.
 *
 * Hand-rolled rather than `Intl.RelativeTimeFormat` for the same reason
 * `formatINR` is: Hermes' Intl support is unreliable across the RN versions
 * this app targets, and a formatter that silently returns the wrong string on
 * one engine is worse than a plain one that is the same everywhere.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return 'now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  const date = new Date(then);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
