import { z } from 'zod';
import { paiseSchema, unsignedPaiseSchema } from '../common/money';

/**
 * `GET /v1/fleet/reports` (§9.3.8): per truck / driver / period; utilization,
 * revenue, compliance history; CSV export.
 *
 * §9.3.8's AC — "report queries hit read paths (no impact on live ops)" — is
 * why every row shape here is servable from the `earnings_daily` projection
 * through the `DB_READER` handle. The truck grain is the one exception and it
 * says so on the field that needs it.
 */

export const reportGroupBySchema = z.enum(['truck', 'driver', 'period']);
export type ReportGroupBy = z.infer<typeof reportGroupBySchema>;

export const reportGranularitySchema = z.enum(['day', 'week', 'month']);
export type ReportGranularity = z.infer<typeof reportGranularitySchema>;

export const reportQuerySchema = z.object({
  groupBy: reportGroupBySchema,
  /** Inclusive IST date bounds — the projection's grain. */
  from: z.iso.date(),
  to: z.iso.date(),
  /** Honoured only when `groupBy=period`; ignored otherwise. */
  granularity: reportGranularitySchema.default('day'),
});
export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const truckReportRowSchema = z.object({
  truckId: z.uuid(),
  plate: z.string(),
  type: z.string(),
  status: z.string(),
  jobs: z.number().int(),
  inServiceDays: z.number().int(),
  activeDays: z.number().int(),
  /**
   * A PERIOD metric: the share of the truck's in-service days on which it ran
   * at least one job. This is NOT the dashboard's instantaneous utilisation
   * (trucks on an active booking ÷ active trucks) — same word, different scope.
   */
  utilizationPct: z.number(),
  grossPaise: unsignedPaiseSchema,
  fleetSharePaise: paiseSchema,
  complianceExpiringCount: z.number().int(),
  complianceExpiredCount: z.number().int(),
});
export type TruckReportRow = z.infer<typeof truckReportRowSchema>;

export const driverReportRowSchema = z.object({
  driverId: z.uuid(),
  name: z.string(),
  kycStatus: z.string(),
  jobs: z.number().int(),
  grossPaise: unsignedPaiseSchema,
  driverSharePaise: paiseSchema,
  fleetSharePaise: paiseSchema,
  ratingAvg: z.number().nullable(),
});
export type DriverReportRow = z.infer<typeof driverReportRowSchema>;

export const periodReportRowSchema = z.object({
  /** ISO date of the bucket start (day, ISO week Monday, or month first). */
  bucket: z.iso.date(),
  jobs: z.number().int(),
  grossPaise: unsignedPaiseSchema,
  commissionPaise: unsignedPaiseSchema,
  poolPaise: unsignedPaiseSchema,
  driverSharePaise: paiseSchema,
  fleetSharePaise: paiseSchema,
});
export type PeriodReportRow = z.infer<typeof periodReportRowSchema>;

/**
 * A discriminated union rather than one wide row: a truck report has no
 * `driverSharePaise` and a period report has no `plate`, and making every
 * consumer null-check the other two grains' columns is how report screens rot.
 */
export const reportResponseSchema = z.discriminatedUnion('groupBy', [
  z.object({
    groupBy: z.literal('truck'),
    period: z.object({ from: z.iso.date(), to: z.iso.date() }),
    rows: z.array(truckReportRowSchema),
  }),
  z.object({
    groupBy: z.literal('driver'),
    period: z.object({ from: z.iso.date(), to: z.iso.date() }),
    rows: z.array(driverReportRowSchema),
  }),
  z.object({
    groupBy: z.literal('period'),
    period: z.object({ from: z.iso.date(), to: z.iso.date() }),
    granularity: reportGranularitySchema,
    rows: z.array(periodReportRowSchema),
  }),
]);
export type ReportResponse = z.infer<typeof reportResponseSchema>;
