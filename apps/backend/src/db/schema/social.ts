import { boolean, index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { socialProviderEnum } from './enums';

/**
 * Google / Apple sign-in bindings (§9.1).
 *
 * A separate table rather than provider columns on `users` for two reasons: one
 * person can hold both a Google and an Apple identity, and the same binding
 * shape has to serve `drivers` too — which is why `subject_id` carries no
 * foreign key and is paired with `subject_type`, exactly as
 * `refresh_tokens.subject_id` and `payout_accounts.owner_id` already are.
 *
 * Unique on `(provider, provider_subject, SUBJECT_TYPE)`, not on the first two.
 * One person can drive and also book tows, and phone login already treats that
 * as two accounts — `users.mobile` and `drivers.mobile` are independent unique
 * keys. Without `subject_type` in the constraint, a driver signing in with the
 * Google account they already use as a customer silently fails to get a binding,
 * and every later sign-in orphans another driver row.
 *
 * The provider's `sub` claim is the only stable identifier it offers. Email is
 * NOT an identity here — Google addresses change hands, and an unverified one is
 * an account-takeover vector.
 */
export const socialIdentities = pgTable(
  'social_identities',
  {
    id: primaryId(),
    provider: socialProviderEnum('provider').notNull(),
    /** The provider's `sub` claim. Opaque, stable, and never an email. */
    providerSubject: text('provider_subject').notNull(),
    /** `'user' | 'driver'` — a CHECK constraint in the migration pins the set. */
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    email: text('email'),
    emailVerified: boolean('email_verified').notNull().default(false),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('uq_social_identities_provider_subject').on(t.provider, t.providerSubject, t.subjectType),
    index('idx_social_identities_subject').on(t.subjectType, t.subjectId),
  ],
);
