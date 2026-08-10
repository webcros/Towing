import { sql } from 'drizzle-orm';
import { numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

/** UUID primary key generated in-database (§17: UUID PKs on every table). */
export const primaryId = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`);

/**
 * `created_at`/`updated_at` on all tables (§17). Stored with time zone so the
 * ap-south deployment and local dev never disagree about an instant.
 */
export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

/**
 * Money column. NUMERIC so fare/commission/payout arithmetic never drifts
 * (§3.4). Read back as a string on purpose — routing it through a JS float is
 * exactly the rounding bug the ledger invariant test exists to catch.
 */
export const money = (name: string) => numeric(name, { precision: 12, scale: 2 });
