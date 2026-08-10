import { z } from 'zod';

/** Standard error envelope for every API error response (spec §16). */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/** Stable machine-readable error codes shared by backend and clients. */
export const ErrorCodes = {
  VALIDATION_FAILED: 'validation_failed',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
  CONFLICT: 'conflict',
  IDEMPOTENCY_REPLAY_MISMATCH: 'idempotency_replay_mismatch',
  TRUCK_ALREADY_ASSIGNED: 'truck_already_assigned',
  DUPLICATE_PLATE: 'duplicate_plate',
  DUPLICATE_MOBILE: 'duplicate_mobile',
  /** Realtime is switched off (REALTIME_ENABLED=false) — clients fall back to REST polling (§19.2). */
  REALTIME_UNAVAILABLE: 'realtime_unavailable',

  // --- Money & settings (Phase 7) -----------------------------------------
  /**
   * §9.3.1: "account usable only after business profile completes". Scoped to
   * the money paths — requesting a payout or linking a bank account. `details`
   * carries `{ onboardingStep, missing }` so the console can deep-link the
   * wizard to the step that is actually blocking.
   */
  PROFILE_INCOMPLETE: 'profile_incomplete',
  /** No `active` payout_accounts row — the payout has no destination (§14.4). */
  PAYOUT_ACCOUNT_NOT_LINKED: 'payout_account_not_linked',
  /** Below `PAYOUT_MIN_PAISE` (§14.4 "min threshold"). `details.minPaise`. */
  PAYOUT_BELOW_MINIMUM: 'payout_below_minimum',
  /** Above `PAYOUT_MAX_PAISE` — a units-bug guard, not a product rule. */
  PAYOUT_ABOVE_MAXIMUM: 'payout_above_maximum',
  /** One open payout per owner (`uq_payouts_one_open_per_owner`). */
  PAYOUT_ALREADY_PENDING: 'payout_already_pending',
  /** Wallet balance is less than the requested amount. `details.availablePaise`. */
  INSUFFICIENT_BALANCE: 'insufficient_balance',
  /** Webhook HMAC did not verify (§19.3) — returned before any DB write. */
  INVALID_SIGNATURE: 'invalid_signature',

  INTERNAL: 'internal_error',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
