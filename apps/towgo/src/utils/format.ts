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
