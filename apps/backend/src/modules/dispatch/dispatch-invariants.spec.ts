import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTIVE_JOB_STATUSES } from '../bookings/booking-state-machine.service';

/**
 * The migration and the code, held in step.
 *
 * TWO SOURCES OF TRUTH THAT MUST NOT DRIFT. Migration 0014's
 * `uq_bookings_one_active_per_driver` names the four active statuses in a
 * hand-written SQL predicate; `ACTIVE_JOB_STATUSES` names them in TypeScript.
 * Nothing connects them, so adding a fifth active state to the enum would leave
 * the index silently not covering it — and the double-assignment backstop would
 * have a hole exactly where the newest, least-tested state is.
 *
 * `booking-state-machine.spec.ts` already does this for migration 0012's
 * customer-side index. This is the same mechanism for the driver-side one, and
 * for the outcome vocabulary.
 */

const MIGRATION = resolve(__dirname, '../../../drizzle/0014_dispatch_engine.sql');

function migrationSql(): string {
  return readFileSync(MIGRATION, 'utf8');
}

/** The quoted-or-bare values inside the first `IN (...)` after a marker. */
function statusesIn(sql: string, marker: string): string[] {
  const from = sql.indexOf(marker);
  expect(from).toBeGreaterThan(-1);
  const open = sql.indexOf('IN (', from);
  const close = sql.indexOf(')', open);
  return sql
    .slice(open + 4, close)
    .split(',')
    .map((value) => value.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

describe('migration 0014 stays in step with the code', () => {
  it('the one-active-per-driver index covers exactly ACTIVE_JOB_STATUSES', () => {
    const statuses = statusesIn(migrationSql(), 'uq_bookings_one_active_per_driver');

    expect(statuses.sort()).toEqual([...ACTIVE_JOB_STATUSES].sort());
  });

  it('deliberately excludes `searching` — a searching booking has no driver', () => {
    const statuses = statusesIn(migrationSql(), 'uq_bookings_one_active_per_driver');

    // Including it would refuse a second booking from a driver who has none,
    // because `driver_id` is null during a search and nulls do not collide —
    // but stating it here pins the intent rather than the accident.
    expect(statuses).not.toContain('searching');
  });

  it('constrains dispatch_attempts.outcome to the five documented values', () => {
    const sql = migrationSql();
    const from = sql.indexOf('ck_dispatch_attempts_outcome');
    expect(from).toBeGreaterThan(-1);
    const open = sql.indexOf('IN (', from);
    const close = sql.indexOf(')', open);
    const outcomes = sql
      .slice(open + 4, close)
      .split(',')
      .map((value) => value.trim().replace(/^'|'$/g, ''));

    // The acceptance rate is `accepted / (accepted + rejected + expired)`, so a
    // sixth value added here without updating `recomputeAcceptanceRate` would
    // silently change every driver's dispatch score.
    expect(outcomes.sort()).toEqual(
      ['accepted', 'expired', 'offered', 'rejected', 'revoked'].sort(),
    );
  });

  it('backs the acceptance-rate window with a driver-keyed index', () => {
    const sql = migrationSql();

    expect(sql).toContain('idx_dispatch_attempts_driver');
    // `DESC NULLS LAST` spelled out — a query ordering only `desc` gets a Sort
    // node bolted on top of the index (engineering note 5).
    expect(sql).toMatch(/"offered_at"\s+DESC\s+NULLS\s+LAST/);
  });
});
