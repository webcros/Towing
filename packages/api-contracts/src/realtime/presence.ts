/**
 * Presence thresholds (§11.6 "degraded-network behavior", the plan's "honesty
 * states"). Shared by the backend and the console so a marker never greys at one
 * age on the server and another in the browser.
 *
 * These are NOT the same number as the Redis `truck:{id}` hash TTL (30s, see
 * `TRUCK_HASH_TTL_MS`). The hash expiring means "no fresh position available",
 * not "this truck ceased to exist" — the client keeps every truck it has seen
 * and ages it locally, with the Postgres last-known point as the floor.
 */

/** §6.1: a driver whose last ping is older than this is phantom supply. */
export const PRESENCE_STALE_MS = 15_000;

/** §11.6: past this the marker is honestly "offline", not merely reconnecting. */
export const PRESENCE_OFFLINE_MS = 60_000;

/**
 * TTL on the Redis `truck:{id}` hash written by the ping path. Deliberately
 * between the two thresholds above: a stale-but-recent truck stays *visible* to
 * ops tooling while already being invisible to the dispatch matcher (§6.1).
 */
export const TRUCK_HASH_TTL_MS = 30_000;

export type Presence = 'live' | 'stale' | 'offline';

/**
 * `atMs` is the ping timestamp, `nowMs` the observer's clock. A future-dated
 * ping (clock skew on the driver's phone) reads as `live` rather than negative-
 * age nonsense.
 */
export function presenceFor(atMs: number | null | undefined, nowMs: number): Presence {
  if (atMs === null || atMs === undefined || !Number.isFinite(atMs)) return 'offline';
  const ageMs = nowMs - atMs;
  if (ageMs < PRESENCE_STALE_MS) return 'live';
  if (ageMs < PRESENCE_OFFLINE_MS) return 'stale';
  return 'offline';
}
