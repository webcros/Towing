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

/**
 * TTL on the Redis `driver:{id}` hash written by the driver ping path (Phase
 * 16). Same value and same reasoning as `TRUCK_HASH_TTL_MS`, declared
 * separately because the two keys are written by different paths and a future
 * decision to age drivers faster than trucks must not require touching both.
 *
 * A GEO set member carries NO per-member TTL, so `drivers:online:{zone}` is
 * pruned by go-offline, by the ping path's read-repair, and by the liveness
 * filter below — never by expiry.
 */
export const DRIVER_HASH_TTL_MS = 30_000;

/**
 * §11.8 ping cadence, pushed to the handset over `config:update` rather than
 * compiled into it — battery/fidelity tuning must not need an app release, and
 * an app release takes days of store review.
 *
 * `offline` is `null`, not zero: nothing is captured at all when the driver is
 * offline (§20.4), which is a different statement from "capture rarely".
 */
export const PING_CADENCE = {
  /** On an active job — the customer is watching a marker move. */
  onJobMs: 3_000,
  /** Online but idle — enough to stay inside `PRESENCE_STALE_MS`, no more. */
  idleMs: 10_000,
  /** Offline: no capture. */
  offlineMs: null,
} as const;

/**
 * A fix this coarse is not a position, it is a neighbourhood. §11.3 asks for it
 * to be flagged rather than discarded — the client renders a halo instead of a
 * confident dot, because a bad fix is still better than no fix when it is the
 * only one we have.
 */
export const LOW_ACCURACY_METERS = 50;
