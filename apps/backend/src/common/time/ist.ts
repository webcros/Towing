/**
 * Fleet-facing "today"/"this month" boundaries in Asia/Kolkata (spec market).
 * IST has no DST, so a fixed offset is exact — no timezone library needed.
 */
const IST_OFFSET_MS = 5.5 * 3_600_000;
const DAY_MS = 86_400_000;

/** UTC instant of the current IST day's midnight. */
export function istDayStart(now: Date = new Date()): Date {
  return new Date(Math.floor((now.getTime() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS);
}

/** UTC instant of the current IST month's first midnight. */
export function istMonthStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + IST_OFFSET_MS);
  const monthStartShifted = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return new Date(monthStartShifted - IST_OFFSET_MS);
}
