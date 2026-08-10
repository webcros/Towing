import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';

/**
 * §20.4 DPDP — consent capture and account-deletion requests (Phase 12).
 * Dual-realm: a row's `subject_id`/`subject_type` names either a `users` row
 * or a `drivers` row, polymorphic and FK-free — same idiom as `devices`,
 * `login_challenges` and `social_identities`, pinned by a hand-written CHECK
 * in the migration (drizzle-kit emits neither CHECK constraints nor partial
 * unique indexes).
 */
export const consentRecords = pgTable(
  'consent_records',
  {
    id: primaryId(),
    subjectId: uuid('subject_id').notNull(),
    /** `'user' | 'driver'` — CHECK-constrained in the migration. */
    subjectType: text('subject_type').notNull(),
    /** `'privacy_policy' | 'terms_of_service'` — plain text, not an enum: the set is app copy, not a data invariant. */
    policyType: text('policy_type').notNull(),
    policyVersion: text('policy_version').notNull(),
    consentedAt: timestamp('consented_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index('idx_consent_records_subject').on(t.subjectType, t.subjectId)],
);

/**
 * A driver/customer files a deletion request; Phase 20's retention/erasure
 * worker executes it. Not a hard delete at request time — bookings and the
 * ledger FK to the subject and must survive for accounting/audit history;
 * `users.status`/an eventual `drivers` equivalent flip is the worker's job.
 *
 * One open request per subject is enforced by a hand-written partial unique
 * index in the migration (`uq_deletion_requests_one_open_per_subject`, same
 * shape as `uq_payouts_one_open_per_owner`) — a plain index here is the
 * drizzle-kit-visible half of it.
 */
export const deletionRequests = pgTable(
  'deletion_requests',
  {
    id: primaryId(),
    subjectId: uuid('subject_id').notNull(),
    subjectType: text('subject_type').notNull(),
    status: text('status').notNull().default('requested'),
    reason: text('reason'),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index('idx_deletion_requests_subject').on(t.subjectType, t.subjectId)],
);
