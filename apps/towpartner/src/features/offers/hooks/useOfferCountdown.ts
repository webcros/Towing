import { useEffect, useState } from 'react';

/**
 * §6.3's twenty-second countdown, driven by an ABSOLUTE server instant.
 *
 * THE CLIENT NEVER STARTS ITS OWN CLOCK, and that is the whole design. The old
 * offer carried `expiresInSeconds` and the screen counted down from it locally —
 * which means every second of network latency, every render delay and any clock
 * the handset felt like keeping made the driver's window LONGER than the
 * server's. Two drivers could then both believe they held the same booking, and
 * the second one to tap Accept would take a 409 they could not explain.
 *
 * Recomputing from `expiresAt - now` on every tick has none of that: a slow
 * frame loses a frame, not a second, and the countdown reaches zero at the same
 * instant the server's delayed job fires.
 *
 * It is allowed to reach zero and stay there. An offer that expired while the
 * screen was open should show 0 and a dismissed state — not a countdown that
 * quietly restarts, and not a negative number.
 */
export function useOfferCountdown(expiresAt: string | undefined): {
  secondsLeft: number;
  /** 1 at the start, 0 at expiry — what the ring renders. */
  fraction: number;
  expired: boolean;
} {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    // 250 ms rather than 1 s: at one-second granularity the ring visibly
    // stutters, and the number can appear to skip when a tick lands just after
    // a second boundary.
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [expiresAt]);

  if (!expiresAt) return { secondsLeft: 0, fraction: 0, expired: true };

  const endsAt = new Date(expiresAt).getTime();
  const remainingMs = Math.max(0, endsAt - now);

  /**
   * The ring's full length is inferred from the longest remaining time this
   * hook has seen, NOT from a hardcoded twenty seconds — `offerTimeoutSeconds`
   * is a per-zone admin setting (§6.7) and can be anything from 5 to 120. A
   * fixed denominator would draw a ring that starts half-full in a zone tuned
   * differently from the default.
   */
  const totalMs = Math.max(remainingMs, initialWindowMs(expiresAt, endsAt));

  return {
    secondsLeft: Math.ceil(remainingMs / 1_000),
    fraction: totalMs === 0 ? 0 : remainingMs / totalMs,
    expired: remainingMs === 0,
  };
}

/**
 * The window this offer started with, remembered per `expiresAt`.
 *
 * The first time an offer is seen its remaining time IS (near enough) its full
 * window, and every later render measures against that. Keyed on the instant
 * itself so a new offer gets a new baseline rather than inheriting the previous
 * one's.
 */
const windows = new Map<string, number>();

function initialWindowMs(expiresAt: string, endsAt: number): number {
  const known = windows.get(expiresAt);
  if (known !== undefined) return known;

  const window = Math.max(1_000, endsAt - Date.now());
  windows.set(expiresAt, window);
  // Unbounded growth would be a leak on a long shift; an offer's key is
  // worthless a minute after it expired.
  if (windows.size > 32) {
    const oldest = windows.keys().next().value;
    if (oldest !== undefined) windows.delete(oldest);
  }
  return window;
}
