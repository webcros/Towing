import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { FleetId, PayoutStatus } from '@towing/api-contracts';
import { DB, type Database } from '../../db/db.module';

export interface PayoutRow {
  id: string;
  ownerId: string;
  /**
   * ALL THREE `wallet_owner_type` values. This was narrowed to
   * `'fleet' | 'driver'` and reached via an unchecked cast in `toRow`, so a
   * `'user'` row — which the column permits and `wallets` already stores —
   * flowed through typed as something it is not. Harmless while nothing
   * branched on it; Phase 13's recipient resolver does.
   */
  ownerType: 'user' | 'driver' | 'fleet';
  amount: string;
  status: PayoutStatus;
  routeRef: string | null;
  failureReason: string | null;
  provider: string | null;
  requestedAt: Date;
  paidAt: Date | null;
}

/** Raw `db.execute` returns timestamps as strings; coerced once, here. */
function toRow(row: Record<string, unknown>): PayoutRow {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    ownerType: row.owner_type as 'user' | 'driver' | 'fleet',
    amount: row.amount as string,
    status: row.status as PayoutStatus,
    routeRef: (row.route_ref as string | null) ?? null,
    failureReason: (row.failure_reason as string | null) ?? null,
    provider: (row.provider as string | null) ?? null,
    requestedAt: new Date(row.requested_at as string),
    paidAt: row.paid_at ? new Date(row.paid_at as string) : null,
  };
}

@Injectable()
export class PayoutsRepo {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Creates the payout row. The two unique indexes it can violate mean
   * different things and the caller must be able to tell them apart, so the
   * error is left to bubble with its constraint name intact.
   */
  async create(params: {
    fleetId: FleetId;
    amount: string;
    idempotencyKey: string;
    provider: string;
  }): Promise<PayoutRow> {
    const rows = (await this.db.execute(sql`
      insert into payouts (owner_id, owner_type, amount, status, idempotency_key, provider)
      values (${params.fleetId}::uuid, 'fleet', ${params.amount}::numeric, 'requested',
              ${params.idempotencyKey}, ${params.provider})
      returning *
    `)) as unknown as Array<Record<string, unknown>>;

    return toRow(rows[0]!);
  }

  /**
   * The fund account a payout pays into. Null when nothing is linked, which the
   * caller turns into `payout_account_not_linked` rather than a vendor call
   * with an empty destination.
   */
  async activeDestination(fleetId: FleetId): Promise<string | null> {
    const rows = (await this.db.execute(sql`
      select route_fund_account_id from payout_accounts
       where owner_type = 'fleet' and owner_id = ${fleetId}::uuid and status = 'active'
    `)) as unknown as Array<{ route_fund_account_id: string | null }>;

    return rows[0]?.route_fund_account_id ?? null;
  }

  async byIdempotencyKey(key: string): Promise<PayoutRow | null> {
    const rows = (await this.db.execute(sql`
      select * from payouts where idempotency_key = ${key}
    `)) as unknown as Array<Record<string, unknown>>;
    return rows[0] ? toRow(rows[0]) : null;
  }

  async byId(payoutId: string): Promise<PayoutRow | null> {
    const rows = (await this.db.execute(sql`
      select * from payouts where id = ${payoutId}::uuid
    `)) as unknown as Array<Record<string, unknown>>;
    return rows[0] ? toRow(rows[0]) : null;
  }

  /**
   * Finds the payout a webhook is about: by the provider reference first, then
   * by our own id echoed back in `notes`. The fallback covers the race where
   * the provider accepted the payout but we crashed before persisting
   * `route_ref` — without it that payout would be stranded until the poll.
   */
  async byProviderRefOrId(providerRef: string | null, payoutId: string | null): Promise<PayoutRow | null> {
    if (providerRef) {
      const rows = (await this.db.execute(sql`
        select * from payouts where route_ref = ${providerRef}
      `)) as unknown as Array<Record<string, unknown>>;
      if (rows[0]) return toRow(rows[0]);
    }

    return payoutId ? this.byId(payoutId) : null;
  }

  /** Records the provider's acceptance. Guarded so a late poll cannot undo a terminal state. */
  async markProcessing(payoutId: string, providerRef: string): Promise<void> {
    await this.db.execute(sql`
      update payouts
         set status = 'processing', route_ref = ${providerRef},
             last_synced_at = now(), updated_at = now()
       where id = ${payoutId}::uuid and status = 'requested'
    `);
  }

  /**
   * The status guard is what makes every transition idempotent AND stops a late
   * webhook un-paying a settled payout. Zero rows returned means the payout was
   * already terminal, and the caller must then do nothing at all — including
   * not writing a compensating ledger entry.
   */
  async transitionToTerminal(
    payoutId: string,
    to: 'paid' | 'failed',
    options: { providerRef?: string | null; failureReason?: string | null } = {},
  ): Promise<PayoutRow | null> {
    const rows = (await this.db.execute(sql`
      update payouts
         set status = ${to}::payout_status,
             paid_at = ${to === 'paid' ? sql`now()` : sql`paid_at`},
             route_ref = coalesce(${options.providerRef ?? null}, route_ref),
             failure_reason = ${options.failureReason ?? null},
             last_synced_at = now(),
             updated_at = now()
       where id = ${payoutId}::uuid
         and status in ('requested', 'processing')
      returning *
    `)) as unknown as Array<Record<string, unknown>>;

    return rows[0] ? toRow(rows[0]) : null;
  }

  async page(
    fleetId: FleetId,
    query: { page: number; limit: number; status?: PayoutStatus },
  ): Promise<{ items: PayoutRow[]; total: number }> {
    const statusFilter = query.status ? sql`and status = ${query.status}::payout_status` : sql``;

    const items = (await this.db.execute(sql`
      select * from payouts
       where owner_type = 'fleet' and owner_id = ${fleetId}::uuid
       ${statusFilter}
       -- Matches idx_payouts_owner_feed exactly; a bare DESC implies NULLS
       -- FIRST and would make Postgres re-sort every page.
       order by requested_at desc nulls last, id desc nulls last
       limit ${query.limit} offset ${(query.page - 1) * query.limit}
    `)) as unknown as Array<Record<string, unknown>>;

    const [count] = (await this.db.execute(sql`
      select count(*)::int as total from payouts
       where owner_type = 'fleet' and owner_id = ${fleetId}::uuid
       ${statusFilter}
    `)) as unknown as [{ total: number }];

    return { items: items.map(toRow), total: count.total };
  }

  /**
   * Non-terminal payouts the reconciliation poll should ask the provider about.
   *
   * The `updated_at` floor is what stops the poll racing a payout that is still
   * mid-request in another process. Bounded, so a backlog cannot turn one tick
   * into thousands of vendor calls.
   */
  async staleNonTerminal(olderThanMinutes: number, limit = 200): Promise<PayoutRow[]> {
    const rows = (await this.db.execute(sql`
      select * from payouts
       where status in ('requested', 'processing')
         and updated_at < now() - (${olderThanMinutes} || ' minutes')::interval
       order by updated_at asc
       limit ${limit}
    `)) as unknown as Array<Record<string, unknown>>;

    return rows.map(toRow);
  }
}
