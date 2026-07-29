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
