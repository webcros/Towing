import { sql } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../../db/schema';

/**
 * The `payout_failed` alert, opened AT THE POINT OF FAILURE.
 *
 * Phase 6 shipped this as `syncPayoutAlerts` inside the hourly compliance
 * sweep, with a comment saying so: the dashboard feed had just become
 * stored-only and no payout write path existed yet, so a failed payout would
 * otherwise have silently stopped appearing. Phase 7 has the write path, and
 * the sweep block is gone.
 *
 * The upsert below is COPIED from that block rather than rewritten, so the
 * dedup semantics — `uq_alerts_open_subject`, the partial unique index over
 * unresolved rows only — are provably unchanged. A payout that fails, is
 * resolved, and legitimately fails again next month still alerts again.
 *
 * A plain function over a Drizzle handle, like `runComplianceSweep`, because it
 * is called from a service, from the nightly job, and from tests.
 */

export type AlertDatabase = PostgresJsDatabase<typeof schema>;

/**
 * Opens (or refreshes) the alert for one failed payout. Idempotent: calling it
 * twice updates the message and leaves a single open row.
 *
 * Fleet payouts only. `alerts.fleet_id` is a FK to `fleets`, and `payouts` has
 * no fleet column — `owner_id` IS the fleet id when `owner_type = 'fleet'`,
 * which is exactly why a driver payout (Phase 19) cannot be represented here
 * and needs its own driver-facing surface.
 */
export async function openPayoutFailedAlert(
  db: AlertDatabase,
  payoutId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const opened = (await db.execute(sql`
    insert into alerts (fleet_id, type, severity, message, href, subject_type, subject_id)
    select
      p.owner_id,
      'payout_failed'::alert_type,
      'error'::alert_severity,
      'Payout of ₹' || trim(to_char(p.amount, 'FM999,999,999.00')) ||
        ' failed — ' || coalesce(p.failure_reason, 'check bank details'),
      '/earnings',
      'payout'::alert_subject_type,
      p.id
    from payouts p
    where p.id = ${payoutId}::uuid
      and p.owner_type = 'fleet'
      and p.status = 'failed'
    on conflict ("fleet_id", "type", "subject_id") where "resolved_at" is null
    do update set message = excluded.message, updated_at = ${now.toISOString()}
    returning (xmax = 0) as inserted
  `)) as unknown as Array<{ inserted: boolean }>;

  return opened.some((row) => row.inserted);
}

/**
 * Closes the alert for one payout. The other half of what `syncPayoutAlerts`
 * used to do — a payout that goes `failed → paid` must stop shouting at the
 * fleet owner.
 */
export async function resolvePayoutAlert(
  db: AlertDatabase,
  payoutId: string,
  now: Date = new Date(),
): Promise<number> {
  const resolved = (await db.execute(sql`
    update alerts
       set resolved_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
     where subject_type = 'payout'
       and subject_id = ${payoutId}::uuid
       and resolved_at is null
    returning id
  `)) as unknown as Array<{ id: string }>;

  return resolved.length;
}

/**
 * Belt-and-braces sweep for the nightly job: reconcile every open
 * `payout_failed` alert against the payout's actual status, in both directions.
 *
 * `markFailed`/`markPaid` maintain these at the point of transition, so on a
 * healthy system this finds nothing. It exists for the case a status changed by
 * some other route entirely — a manual DB edit during an incident — which is
 * precisely when a stale "your payout failed" banner is most damaging.
 *
 * Returns the number of alerts it had to change.
 */
export async function reconcilePayoutAlerts(
  db: AlertDatabase,
  now: Date = new Date(),
): Promise<number> {
  const opened = (await db.execute(sql`
    insert into alerts (fleet_id, type, severity, message, href, subject_type, subject_id)
    select
      p.owner_id,
      'payout_failed'::alert_type,
      'error'::alert_severity,
      'Payout of ₹' || trim(to_char(p.amount, 'FM999,999,999.00')) ||
        ' failed — ' || coalesce(p.failure_reason, 'check bank details'),
      '/earnings',
      'payout'::alert_subject_type,
      p.id
    from payouts p
    join fleets f on f.id = p.owner_id
    where p.owner_type = 'fleet'
      and p.status = 'failed'
    on conflict ("fleet_id", "type", "subject_id") where "resolved_at" is null
    do nothing
    returning id
  `)) as unknown as Array<{ id: string }>;

  const resolved = (await db.execute(sql`
    update alerts a
       set resolved_at = ${now.toISOString()}, updated_at = ${now.toISOString()}
      from payouts p
     where a.subject_type = 'payout'
       and a.subject_id = p.id
       and a.resolved_at is null
       and p.status <> 'failed'
    returning a.id
  `)) as unknown as Array<{ id: string }>;

  return opened.length + resolved.length;
}
