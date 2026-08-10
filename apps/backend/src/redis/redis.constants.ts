/** DI token for the command connection — inject with `@Inject(REDIS)`. */
export const REDIS = Symbol('REDIS');

/**
 * DI token for a second, dedicated connection. Redis switches a client into
 * subscriber mode on the first SUBSCRIBE and from then on rejects everything
 * except (P)SUBSCRIBE/(P)UNSUBSCRIBE/PING/QUIT — sharing one client would break
 * every GET/SET in the process the moment the tracking gateway subscribed.
 *
 * `RealtimeSubscriberService` is that gateway: it owns this client and
 * multiplexes every realtime channel over its single `message` listener.
 */
export const REDIS_SUB = Symbol('REDIS_SUB');

/**
 * Internal fan-out channel for driver pings (§16.6 `location:update`). The
 * driver's socket and a customer watching the same booking routinely land on
 * different API tasks, so pings cross nodes through Redis rather than being
 * emitted directly to local sockets.
 */
export const LOCATION_CHANNEL = 'location:ping';

/**
 * Domain events that move a fleet's KPIs (truck created/updated, driver
 * assigned, booking transitioned). Producers publish here; `MetricsBroadcaster`
 * turns a burst of them into one recomputed `ops:metrics` payload.
 *
 * Separate from LOCATION_CHANNEL on purpose: pings are high-frequency and
 * disposable, domain events are rare and each one costs a DB recompute.
 */
export const FLEET_EVENTS_CHANNEL = 'fleet:events';

/** Computed KPI payloads, ready to relay verbatim to `fleet:{id}` sockets. */
export const METRICS_CHANNEL = 'ops:metrics';

/**
 * Per-truck hot position hash. Written by the ping path with a 30s TTL
 * (`TRUCK_HASH_TTL_MS` in @towing/api-contracts) and read by the positions
 * snapshot; the dispatch matcher of §6.1 reads the same key.
 */
export const truckHashKey = (truckId: string): string => `truck:${truckId}`;

/** Mirrors §6.1's `drivers:online:{zone}` shape, keyed by tenant for fleet trucks. */
export const truckGeoKey = (fleetId: string): string => `trucks:online:${fleetId}`;

/** Single-use WebSocket handshake ticket (§16.6 handshake auth). */
export const wsTicketKey = (ticket: string): string => `ws:ticket:${ticket}`;

/**
 * Cost guard, not a correctness guard: whichever node wins this recomputes the
 * fleet's KPIs. Losing it costs one skipped push, which the console's 15s
 * staleTime and its on-reconnect REST resync already cover.
 */
export const metricsLockKey = (fleetId: string): string => `ops:metrics:lock:${fleetId}`;
