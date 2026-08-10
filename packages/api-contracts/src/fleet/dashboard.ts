import { z } from 'zod';
import { unsignedPaiseSchema } from '../common/money';

export const fleetAlertSchema = z.object({
  id: z.string(),
  type: z.enum(['doc_expiring', 'doc_expired', 'truck_idle', 'payout_failed']),
  severity: z.enum(['info', 'warning', 'error']),
  message: z.string(),
  /** Console route the alert deep-links to (spec §9.3.2 AC). */
  href: z.string(),
  createdAt: z.iso.datetime(),
});
export type FleetAlertDto = z.infer<typeof fleetAlertSchema>;

/**
 * Split out of the summary so the realtime `ops:metrics` event (§16.6) can carry
 * exactly this shape — the console patches it straight into the cached summary
 * with `setQueryData`, so the two must never drift.
 */
export const dashboardKpisSchema = z.object({
  activeTrucks: z.number().int(),
  totalTrucks: z.number().int(),
  jobsToday: z.number().int(),
  /** Today's fleet_share_credit sum (IST day boundary). */
  revenueTodayPaise: unsignedPaiseSchema,
  /**
   * Distinct assigned trucks of drivers on active bookings ÷ active trucks.
   * Honest proxy until bookings carry a truck_id.
   */
  utilizationPct: z.number().int().min(0).max(100),
});
export type DashboardKpisDto = z.infer<typeof dashboardKpisSchema>;

export const dashboardSummarySchema = z.object({
  kpis: dashboardKpisSchema,
  alerts: z.array(fleetAlertSchema),
});
export type DashboardSummaryDto = z.infer<typeof dashboardSummarySchema>;
