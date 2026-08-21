import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { DevicePlatform } from '@towing/api-contracts';
import { primaryId, timestamps } from './columns';

/**
 * Per-device push tokens (§12). A driver or customer can reinstall the app or
 * carry two devices, so this is a table rather than a column on `drivers` /
 * `users` — Phase 13's notification fan-out reaches every live device, not just
 * the last one that logged in.
 *
 * `subject_id` is POLYMORPHIC AND FK-FREE, paired with `subject_type` — the
 * same shape `login_challenges` and `social_identities` already use, pinned by
 * a hand-written CHECK in the migration (drizzle-kit does not emit those).
 *
 * ⚠ THE SUBJECT VOCABULARY CHANGED IN MIGRATION 0010, from `('driver',
 * 'customer')` to `('user','driver')`. This table shipped schema-only in
 * Phase 11 and was the ONLY polymorphic subject table in the repo spelled
 * `'customer'` — `login_challenges`, `social_identities`, `consent_records` and
 * `deletion_requests` all pin `('user','driver')`, and `wallet_owner_type` is
 * `('user','driver','fleet')`. Nothing had ever written a row, so normalising
 * it in the phase that starts writing was free; leaving it would have meant a
 * translation layer between the device registry and every recipient resolver,
 * and a data migration later.
 */
export const devices = pgTable(
  'devices',
  {
    id: primaryId(),
    subjectId: uuid('subject_id').notNull(),
    /** `'user' | 'driver'` — CHECK-constrained in migration 0010. */
    subjectType: text('subject_type').notNull().$type<'user' | 'driver'>(),
    /**
     * Expo push token, or null when the OS permission was denied. Nullable on
     * purpose: the row is still worth having (app version, last-seen, and it
     * flips to a real token if permission is granted later without the client
     * needing to know whether it is inserting or updating).
     */
    pushToken: text('push_token'),
    platform: text('platform').$type<DevicePlatform>(),
    appVersion: text('app_version'),
    /**
     * Client-generated, opaque, and STABLE ACROSS PUSH-TOKEN ROTATION. This is
     * the identity of the physical install; `push_token` is a credential that
     * changes under it. Without it, every Expo token rotation would insert a
     * second row and the same person would get every notification twice.
     */
    installationId: text('installation_id').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    /**
     * Set when a session on this handset ends — logout, suspension, KYC
     * rejection, or account deletion (invariant 73). A revoked row is never a
     * push target. Soft rather than a DELETE so
     * `notification_deliveries.device_id` keeps pointing somewhere and the
     * shared-handset history stays legible.
     */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: text('revoked_reason'),
    ...timestamps,
  },
  (t) => [index('idx_devices_subject').on(t.subjectType, t.subjectId)],
);
