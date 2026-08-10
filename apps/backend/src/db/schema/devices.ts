import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';

/**
 * Per-device push tokens (§12). A driver or customer can reinstall the app or
 * carry two devices, so this is a table rather than a column on `drivers` /
 * `users` — Phase 13's notification fan-out needs to reach every live device,
 * not just the last one that logged in.
 *
 * `subject_id` is POLYMORPHIC AND FK-FREE, paired with `subject_type` — the
 * same shape `login_challenges` and `social_identities` already use, pinned by
 * a hand-written CHECK in the migration (drizzle-kit does not emit those).
 *
 * Schema-only in Phase 11: nothing writes to this table yet. Same standing as
 * `admin_users.twofa_secret` — the column exists so Phase 13 is additive
 * rather than a migration.
 */
export const devices = pgTable(
  'devices',
  {
    id: primaryId(),
    subjectId: uuid('subject_id').notNull(),
    /** `'driver' | 'customer'` — CHECK-constrained in the migration. */
    subjectType: text('subject_type').notNull(),
    pushToken: text('push_token'),
    platform: text('platform'),
    appVersion: text('app_version'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('idx_devices_subject').on(t.subjectType, t.subjectId)],
);
