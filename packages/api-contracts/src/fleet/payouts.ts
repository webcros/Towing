import { z } from 'zod';
import { unsignedPaiseSchema } from '../common/money';
import { pageEnvelopeSchema, pageQuerySchema } from '../common/pagination';

/**
 * `POST /v1/fleet/payouts` + `GET /v1/fleet/payouts` (§9.3.7, §14.4).
 *
 * The status vocabulary is §5.5's, verbatim: `payout_requested → processing
 * (Route) → paid | failed`. The Phase 2 mock typed the first state as
 * `pending`; that was mock-only and shipped to nobody, so the DB enum wins and
 * clients derive their type from this schema rather than hand-declaring one.
 */
export const payoutStatusSchema = z.enum(['requested', 'processing', 'paid', 'failed']);
export type PayoutStatus = z.infer<typeof payoutStatusSchema>;

export const payoutSchema = z.object({
  id: z.uuid(),
  amountPaise: unsignedPaiseSchema,
  status: payoutStatusSchema,
  requestedAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  /** Provider reference (Razorpay Route payout id) once accepted, else null. */
  providerRef: z.string().nullable(),
  /** Populated only for `failed` — rendered verbatim in the alert and the row. */
  failureReason: z.string().nullable(),
});
export type PayoutDto = z.infer<typeof payoutSchema>;

/**
 * The body carries only the amount. The idempotency key travels in the
 * `Idempotency-Key` header — the one the interceptor already keys on and the
 * BFF already forwards. A body field would be a *second* key that can disagree
 * with the header, and then which one wins is a coin flip.
 */
export const payoutRequestSchema = z.object({
  amountPaise: unsignedPaiseSchema.min(1),
});
export type PayoutRequest = z.infer<typeof payoutRequestSchema>;

export const payoutsQuerySchema = pageQuerySchema.extend({
  status: payoutStatusSchema.optional(),
});
export type PayoutsQuery = z.infer<typeof payoutsQuerySchema>;

export const payoutsListResponseSchema = pageEnvelopeSchema(payoutSchema);
export type PayoutsListResponse = z.infer<typeof payoutsListResponseSchema>;
