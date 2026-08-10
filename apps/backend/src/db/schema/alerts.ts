import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { alertSeverityEnum, alertSubjectTypeEnum, alertTypeEnum } from './enums';
import { fleets } from './fleets';

/**
 * Stored fleet alerts (§9.3.2, §9.3.4).
 *
 * Before Phase 6 the dashboard derived these on every read from the current
 * state of compliance docs and payouts. That is fine for rendering a list and
 * useless for everything else: a derived alert has no honest `created_at`, no
 * "seen at", cannot be resolved, and cannot drive a notification exactly once.
 * The compliance worker writes rows here instead, and the dashboard reads them.
 *
 * `resolved_at` rather than deletion: an alert that fired and was fixed is the
 * audit trail for why a truck left dispatch (§9.3.4 AC).
 */
export const alerts = pgTable(
  'alerts',
  {
    id: primaryId(),
    fleetId: uuid('fleet_id')
      .notNull()
      .references(() => fleets.id, { onDelete: 'cascade' }),
    type: alertTypeEnum('type').notNull(),
    severity: alertSeverityEnum('severity').notNull(),
    message: text('message').notNull(),
    /** Console route this deep-links to (§9.3.2 AC). */
    href: text('href').notNull(),
    /**
     * What the alert is ABOUT. Together with `type` this is the dedup key that
     * makes an hourly re-run idempotent — see the partial unique index in
     * migration 0005, which is the real arbiter.
     */
    subjectType: alertSubjectTypeEnum('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // The dashboard feed: unresolved alerts for one fleet, newest first.
    index('idx_alerts_fleet_open').on(t.fleetId, t.createdAt.desc()),
  ],
);
