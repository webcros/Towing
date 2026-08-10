/**
 * Every `wallet_transactions.idempotency_key` this application writes, built
 * here so a raw string literal never appears at a call site.
 *
 * Grammar: `<source>:<version>:<entity>:<id>[:<leg>]` — the same four-segment
 * shape the seed already uses (`seed:v1:bk:<i>:driver`). The first segment is
 * the SOURCE: `seed` for seeded data, `bk`/`po`/`adj` for live data. `seed` is
 * never an entity name and `bk` is never a source, so a collision between
 * seeded and live keys is structurally impossible rather than merely unlikely.
 *
 * **The key is derived from the domain id — never from the client's
 * `Idempotency-Key` header, and never from a fresh UUID.** A retried settlement
 * job computes the same key from the same booking id, so the second attempt is
 * a no-op *even if Redis lost the interceptor's marker*. The header protects
 * the HTTP response; this protects the money. That split is exactly what
 * `IdempotencyInterceptor`'s own docstring promises ("the unique constraints on
 * payments/payouts/wallet idempotency_key are the real backstop; this is the
 * fast path").
 *
 * Bump the version segment — never reuse it with different semantics — if the
 * meaning of a leg ever changes.
 */
export const ledgerKeys = {
  /** §14.3 fleet-driver split: the driver's share of the pool. */
  bookingDriverShare: (bookingId: string) => `bk:v1:${bookingId}:driver`,
  /** §14.3 fleet-driver split: the fleet's share of the pool. */
  bookingFleetShare: (bookingId: string) => `bk:v1:${bookingId}:fleet`,
  /** Independent driver: the whole pool as one credit. */
  bookingNetFare: (bookingId: string) => `bk:v1:${bookingId}:net`,
  /** The hold written when a payout is requested (§14.4). */
  payoutDebit: (payoutId: string) => `po:v1:${payoutId}:debit`,
  /** The compensating credit when that payout fails (§14.5: never an edit). */
  payoutReversal: (payoutId: string) => `po:v1:${payoutId}:reversal`,
  /** Manual correction, keyed by whatever record authorises it. */
  adjustment: (adjustmentId: string) => `adj:v1:${adjustmentId}`,
} as const;

export type LedgerKeyBuilder = keyof typeof ledgerKeys;
