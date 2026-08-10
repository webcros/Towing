import { date, index, integer, pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core';
import { money } from './columns';
import { drivers } from './drivers';
import { fleets } from './fleets';

/**
 * The `earnings_daily` read projection (CQRS-lite) that serves `/fleet/earnings`
 * and `/fleet/reports`, so §9.3.8's AC — "report queries hit read paths (no
 * impact on live ops)" — is structural rather than aspirational. Maintained by
 * a ledger-consuming worker; every read goes through the `DB_READER` handle.
 *
 * **Grain: `(fleet_id, IST day, driver_id)`.**
 *
 *  - Per driver, not just per fleet-day, because `reports?groupBy=driver` needs
 *    the dimension and fleet-per-day is a trivial `GROUP BY` over the finer
 *    grain. One table serves both; two tables would need a second worker and a
 *    second consistency proof.
 *  - Payouts are deliberately excluded. A `payout_debit` has no driver, and a
 *    nullable `driver_id` does not dedupe in a Postgres unique key (NULLs are
 *    distinct), so a sentinel would be the only alternative. This stays an
 *    *earnings* projection: everything in it is booking-derived and
 *    driver-attributable. Payout history reads `payouts` directly and the wallet
 *    balance is `wallets.balance`.
 *  - **`day` is an IST calendar day**, `(created_at AT TIME ZONE 'Asia/Kolkata')::date`
 *    of the ledger row. A UTC-day projection would silently disagree with the
 *    dashboard's `istDayStart()`-based revenue by up to 5.5 hours of jobs every
 *    night, and nothing would fail loudly.
 *  - Driven off the ledger's `created_at`, not the booking's: money lands on the
 *    day it is credited, and this is a ledger projection.
 *
 * **Deliberate deviation from §17's "UUID PK on every table": the grain IS the
 * identity.** A surrogate `id` plus a unique index on the triple would be two
 * keys for one thing and would make the projector's upsert clumsier.
 */
export const earningsDaily = pgTable(
  'earnings_daily',
  {
    fleetId: uuid('fleet_id')
      .notNull()
      .references(() => fleets.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    driverId: uuid('driver_id')
      .notNull()
      .references(() => drivers.id, { onDelete: 'cascade' }),
    jobs: integer('jobs').notNull().default(0),
    gross: money('gross').notNull().default('0'),
    commission: money('commission').notNull().default('0'),
    pool: money('pool').notNull().default('0'),
    driverShare: money('driver_share').notNull().default('0'),
    fleetShare: money('fleet_share').notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: 'earnings_daily_pkey', columns: [t.fleetId, t.day, t.driverId] }),
    // The trend/report scan: one fleet's window, newest first. `desc nulls last`
    // matches the ORDER BY the read path issues — a bare DESC would make
    // Postgres re-sort every page (the Phase 4 lesson).
    index('idx_earnings_daily_fleet_day').on(t.fleetId, t.day.desc()),
  ],
);
