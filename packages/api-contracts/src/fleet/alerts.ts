import { z } from 'zod';
import { cursorEnvelopeSchema, cursorQuerySchema } from '../common/pagination';
import { fleetAlertSchema } from './dashboard';

/**
 * `GET /v1/fleet/alerts` (§9.3.2, §9.3.4).
 *
 * Reuses `fleetAlertSchema` from the dashboard rather than declaring a parallel
 * shape: the dashboard feed and this list are the same alerts, and the whole
 * point of Phase 6 is that there is now one stored source for both.
 */
export const alertsQuerySchema = cursorQuerySchema.extend({
  /** Default is unresolved only — the feed is a to-do list, not an archive. */
  includeResolved: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  severity: z.enum(['info', 'warning', 'error']).optional(),
});
export type AlertsQuery = z.infer<typeof alertsQuerySchema>;

/**
 * `resolvedAt` lives here and not on `fleetAlertSchema` because the dashboard
 * feed only ever shows unresolved alerts — putting it there would be a field
 * that is always null on the one endpoint most clients call.
 */
export const storedAlertSchema = fleetAlertSchema.extend({
  resolvedAt: z.iso.datetime().nullable(),
});
export type StoredAlertDto = z.infer<typeof storedAlertSchema>;

export const alertsListResponseSchema = cursorEnvelopeSchema(storedAlertSchema);
export type AlertsListResponse = z.infer<typeof alertsListResponseSchema>;
