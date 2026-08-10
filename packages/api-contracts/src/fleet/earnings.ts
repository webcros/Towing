import { z } from 'zod';
import { paiseSchema, unsignedPaiseSchema } from '../common/money';
import { cursorEnvelopeSchema, cursorQuerySchema } from '../common/pagination';
import { commissionBandSchema } from './jobs';

/**
 * `GET /v1/fleet/earnings` and `/earnings/split` (§9.3.7).
 *
 * Deliberately two endpoints rather than the one fat aggregate the mock shipped
 * with: the KPIs and trend come from the `earnings_daily` projection while the
 * per-job breakdown is an unbounded keyset feed over the ledger. One endpoint
 * would let the slowest half gate the whole screen and give the two halves a
 * single cache lifetime.
 */

/** Inclusive ISO date bounds. Both omitted ⇒ the current IST calendar month. */
export const earningsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type EarningsQuery = z.infer<typeof earningsQuerySchema>;

export const earningsTrendPointSchema = z.object({
  /** An IST calendar day — the projection's grain, not a UTC day. */
  date: z.iso.date(),
  grossPaise: paiseSchema,
  fleetSharePaise: paiseSchema,
});
export type EarningsTrendPointDto = z.infer<typeof earningsTrendPointSchema>;

export const earningsWalletSchema = z.object({
  /** Signed: §14 allows a negative balance once cash-on-completion lands. */
  balancePaise: paiseSchema,
  /** balance − amounts locked in `requested`/`processing` payouts. */
  availablePaise: paiseSchema,
  /**
   * Server-driven so the console's disabled state is not a second hardcoded
   * copy of `PAYOUT_MIN_PAISE` that can drift from the server's check.
   */
  minPayoutPaise: unsignedPaiseSchema,
  maxPayoutPaise: unsignedPaiseSchema,
  payoutAccountLinked: z.boolean(),
});

export const earningsTotalsSchema = z.object({
  jobs: z.number().int(),
  grossPaise: unsignedPaiseSchema,
  commissionPaise: unsignedPaiseSchema,
  poolPaise: unsignedPaiseSchema,
  driverSharePaise: unsignedPaiseSchema,
  fleetSharePaise: unsignedPaiseSchema,
});

/**
 * There is deliberately no `fleetSharePct`. The share is configured per driver
 * (`fleet_driver_shares`), so a fleet running 80/20 and 70/30 has no single
 * number — the mock's field was a lie at the summary level. The console renders
 * the *effective* share for the period as `fleetSharePaise / poolPaise` and
 * labels it as such.
 */
export const earningsSummarySchema = z.object({
  period: z.object({ from: z.iso.date(), to: z.iso.date() }),
  wallet: earningsWalletSchema,
  totals: earningsTotalsSchema,
  trend: z.array(earningsTrendPointSchema),
});
export type EarningsSummaryDto = z.infer<typeof earningsSummarySchema>;

export const splitsQuerySchema = cursorQuerySchema.extend({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  driverId: z.uuid().optional(),
});
export type SplitsQuery = z.infer<typeof splitsQuerySchema>;

/**
 * One settled booking's money, end to end: gross → commission → pool → the two
 * legs. §14.3 requires every credit to store the band and % applied, "making
 * driver-facing math and finance reconciliation trivially auditable" — these
 * fields are that guarantee surfaced.
 */
export const jobSplitSchema = z.object({
  bookingId: z.uuid(),
  jobCode: z.string(),
  /** The credit's `created_at` — when the money landed, not when the job ran. */
  settledAt: z.iso.datetime(),
  driverId: z.uuid().nullable(),
  driverName: z.string().nullable(),
  grossPaise: unsignedPaiseSchema,
  commissionBand: commissionBandSchema.nullable(),
  commissionPct: z.number().nullable(),
  commissionPaise: paiseSchema,
  poolPaise: paiseSchema,
  driverSharePaise: paiseSchema,
  /** Zero for an independent driver — the whole pool is a single `fare_credit`. */
  fleetSharePaise: paiseSchema,
});
export type JobSplitDto = z.infer<typeof jobSplitSchema>;

export const splitsListResponseSchema = cursorEnvelopeSchema(jobSplitSchema);
export type SplitsListResponse = z.infer<typeof splitsListResponseSchema>;

/** `GET /v1/fleet/earnings/statement.csv?month=YYYY-MM` — the §9.3.7 monthly statement. */
export const statementQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected a YYYY-MM month'),
});
export type StatementQuery = z.infer<typeof statementQuerySchema>;
