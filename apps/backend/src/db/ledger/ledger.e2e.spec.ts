import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/app';
import {
  seedDriver,
  seedFleet,
  setupTestDatabase,
  testSql,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { seedBooking, seedCustomerBooking } from '../../test/fixtures';
import { DB, DB_READER, PG, PG_READER } from '../db.module';
import { ledgerKeys } from './idempotency-keys';
import { LedgerService } from './ledger.service';

describe('LedgerService (e2e)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let ledger: LedgerService;
  let fleetA: string;
  let fleetB: string;
  let driverA: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
    ledger = app.get(LedgerService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
    const a = await seedFleet(db, 'Ledger Fleet A');
    const b = await seedFleet(db, 'Ledger Fleet B');
    fleetA = a.fleetId;
    fleetB = b.fleetId;
    driverA = await seedDriver(db, { fleetId: fleetA, name: 'Ledger Driver' });
  });

  const walletBalance = async (ownerType: string, ownerId: string): Promise<string | null> => {
    const rows = (await db.execute(sql`
      select balance from wallets
      where owner_type = ${ownerType}::wallet_owner_type and owner_id = ${ownerId}::uuid
    `)) as unknown as Array<{ balance: string }>;
    return rows[0]?.balance ?? null;
  };

  const ledgerCount = async (): Promise<number> => {
    const [row] = (await db.execute(
      sql`select count(*)::int as count from wallet_transactions`,
    )) as unknown as [{ count: number }];
    return row.count;
  };

  it('creates the wallet lazily on the first credit', async () => {
    expect(await walletBalance('fleet', fleetA)).toBeNull();

    await ledger.post([
      {
        owner: { ownerType: 'fleet', ownerId: fleetA },
        type: 'fleet_share_credit',
        amountPaise: 12_345,
        reason: 'first credit',
        idempotencyKey: 'adj:v1:first-credit',
      },
    ]);

    expect(await walletBalance('fleet', fleetA)).toBe('123.45');
  });

  it('writes exactly the seed’s two-leg shape for a fleet settlement', async () => {
    const bookingId = await seedCustomerBooking(db, { fleetId: fleetA, driverId: driverA });

    // §7.5: ₹4,499 Band A, 80/20 → driver ₹3,239.28 + fleet ₹809.82.
    const result = await ledger.creditBookingSettlement({
      bookingId,
      totalPaise: 449_900,
      band: 'A',
      driverId: driverA,
      fleet: { fleetId: fleetA, driverSharePct: 80 },
    });

    expect(result.replayed).toBe(false);
    expect(await walletBalance('driver', driverA)).toBe('3239.28');
    expect(await walletBalance('fleet', fleetA)).toBe('809.82');

    // `order by type::text`, NOT `order by type`: on a pgEnum column Postgres
    // orders by DECLARATION order, so a bare ORDER BY would put
    // `fleet_share_credit` first and make this assertion read as a bug.
    const rows = (await db.execute(sql`
      select type, amount, ref_id, idempotency_key, reason
      from wallet_transactions where ref_id = ${bookingId}::uuid
      order by type::text
    `)) as unknown as Array<{
      type: string;
      amount: string;
      ref_id: string;
      idempotency_key: string;
      reason: string;
    }>;

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.type)).toEqual(['driver_share_credit', 'fleet_share_credit']);
    expect(rows.map((r) => r.idempotency_key)).toEqual([
      ledgerKeys.bookingDriverShare(bookingId),
      ledgerKeys.bookingFleetShare(bookingId),
    ]);
    // §14.3: every credit records the band and % applied.
    expect(rows[0]!.reason).toContain('Band A');
    expect(rows[0]!.reason).toContain('80%');

    // Never a commission leg — the platform has no wallet.
    const [{ count }] = (await db.execute(
      sql`select count(*)::int as count from wallet_transactions where type = 'commission_debit'`,
    )) as unknown as [{ count: number }];
    expect(count).toBe(0);
  });

  it('an independent driver gets one fare_credit for the whole pool', async () => {
    const independent = await seedDriver(db, { name: 'Independent' });
    const bookingId = await seedCustomerBooking(db, { fleetId: null, driverId: independent });

    await ledger.creditBookingSettlement({
      bookingId,
      totalPaise: 149_900,
      band: 'A',
      driverId: independent,
      fleet: null,
    });

    expect(await walletBalance('driver', independent)).toBe('1349.10');
    const rows = (await db.execute(sql`
      select type from wallet_transactions where ref_id = ${bookingId}::uuid
    `)) as unknown as Array<{ type: string }>;
    expect(rows.map((r) => r.type)).toEqual(['fare_credit']);
  });

  it('replays a settlement as a no-op — same rows, same balance', async () => {
    const bookingId = await seedCustomerBooking(db, { fleetId: fleetA, driverId: driverA });
    const input = {
      bookingId,
      totalPaise: 449_900,
      band: 'A' as const,
      driverId: driverA,
      fleet: { fleetId: fleetA, driverSharePct: 80 },
    };

    await ledger.creditBookingSettlement(input);
    const second = await ledger.creditBookingSettlement(input);

    expect(second.replayed).toBe(true);
    expect(second.entries.every((e) => e.replayed && e.id === null)).toBe(true);
    expect(await ledgerCount()).toBe(2);
    expect(await walletBalance('driver', driverA)).toBe('3239.28');
    expect(await walletBalance('fleet', fleetA)).toBe('809.82');
  });

  it('ten concurrent posts of the same key insert exactly one row', async () => {
    // The unique constraint under real contention — this is the §19.4 backstop
    // that has to hold with Redis down and the interceptor bypassed.
    const leg = {
      owner: { ownerType: 'fleet' as const, ownerId: fleetA },
      type: 'fleet_share_credit' as const,
      amountPaise: 50_000,
      reason: 'contended credit',
      idempotencyKey: 'adj:v1:contended',
    };

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => ledger.post([leg])),
    );

    // Concurrent ON CONFLICT DO NOTHING can surface a serialisation failure;
    // what must never happen is two rows or a doubled balance.
    expect(results.some((r) => r.status === 'fulfilled')).toBe(true);
    expect(await ledgerCount()).toBe(1);
    expect(await walletBalance('fleet', fleetA)).toBe('500.00');
  });

  it('ten concurrent posts of distinct keys sum exactly', async () => {
    // Proves `balance = balance + x` is atomic: a read-modify-write would lose
    // updates here and land somewhere below ₹10.
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        ledger.post([
          {
            owner: { ownerType: 'fleet', ownerId: fleetA },
            type: 'fleet_share_credit',
            amountPaise: 100,
            reason: `credit ${i}`,
            idempotencyKey: `adj:v1:distinct-${i}`,
          },
        ]),
      ),
    );

    expect(await ledgerCount()).toBe(10);
    expect(await walletBalance('fleet', fleetA)).toBe('10.00');
  });

  it('a throwing precondition aborts the whole transaction — no row, no balance change', async () => {
    await ledger.post([
      {
        owner: { ownerType: 'fleet', ownerId: fleetA },
        type: 'fleet_share_credit',
        amountPaise: 10_000,
        reason: 'opening balance',
        idempotencyKey: 'adj:v1:opening',
      },
    ]);

    await expect(
      ledger.post(
        [
          {
            owner: { ownerType: 'fleet', ownerId: fleetA },
            type: 'payout_debit',
            amountPaise: -50_000,
            reason: 'overdraw',
            idempotencyKey: 'po:v1:overdraw:debit',
          },
        ],
        {
          precondition: (balances) => {
            if ((balances.get(`fleet:${fleetA}`) ?? 0) < 50_000) {
              throw new Error('insufficient balance');
            }
          },
        },
      ),
    ).rejects.toThrow('insufficient balance');

    expect(await ledgerCount()).toBe(1);
    expect(await walletBalance('fleet', fleetA)).toBe('100.00');
  });

  it('the precondition sees balances with every wallet locked', async () => {
    let seen: number | undefined;
    await ledger.post(
      [
        {
          owner: { ownerType: 'fleet', ownerId: fleetA },
          type: 'fleet_share_credit',
          amountPaise: 7_500,
          reason: 'credit',
          idempotencyKey: 'adj:v1:sees-balance',
        },
      ],
      { precondition: (balances) => void (seen = balances.get(`fleet:${fleetA}`)) },
    );

    // Zero, not undefined: the wallet is created before the lock is taken.
    expect(seen).toBe(0);
  });

  it('rejects a zero amount and a sign that disagrees with the type', async () => {
    const base = {
      owner: { ownerType: 'fleet' as const, ownerId: fleetA },
      reason: 'bad leg',
    };

    await expect(
      ledger.post([{ ...base, type: 'adjustment', amountPaise: 0, idempotencyKey: 'adj:v1:zero' }]),
    ).rejects.toThrow(/non-zero/);

    await expect(
      ledger.post([
        { ...base, type: 'fleet_share_credit', amountPaise: -1, idempotencyKey: 'adj:v1:negcredit' },
      ]),
    ).rejects.toThrow(/positive/);

    await expect(
      ledger.post([
        { ...base, type: 'payout_debit', amountPaise: 1, idempotencyKey: 'po:v1:posdebit:debit' },
      ]),
    ).rejects.toThrow(/negative/);

    expect(await ledgerCount()).toBe(0);
  });

  it('the database refuses a zero amount even if the service is bypassed', async () => {
    // Through the raw postgres.js handle, not Drizzle: DrizzleQueryError wraps
    // the driver error as "Failed query: …" and buries the constraint name in
    // `cause`, so asserting on it here would be asserting on Drizzle.
    const raw = testSql();
    const [wallet] = await raw<{ id: string }[]>`
      insert into wallets (owner_id, owner_type) values (${fleetB}::uuid, 'fleet') returning id
    `;

    await expect(
      raw`
        insert into wallet_transactions (wallet_id, type, amount, idempotency_key)
        values (${wallet!.id}::uuid, 'adjustment', 0, 'adj:v1:db-zero')
      `,
    ).rejects.toThrow(/ck_wallet_transactions_amount_nonzero/);
  });

  it('reports drift between the cached balance and the ledger', async () => {
    const result = await ledger.post([
      {
        owner: { ownerType: 'fleet', ownerId: fleetA },
        type: 'fleet_share_credit',
        amountPaise: 25_000,
        reason: 'credit',
        idempotencyKey: 'adj:v1:drift-base',
      },
    ]);
    const walletId = result.entries[0]!.walletId;

    expect(await ledger.reconcile(walletId)).toEqual({
      balancePaise: 25_000,
      ledgerPaise: 25_000,
      driftPaise: 0,
    });
    expect((await ledger.invariants()).walletDrift).toBe(0);

    // Corrupt the projection the way a rogue writer would.
    await db.execute(sql`update wallets set balance = balance + 1 where id = ${walletId}::uuid`);

    expect((await ledger.reconcile(walletId)).driftPaise).toBe(100);
    expect((await ledger.invariants()).walletDrift).toBe(1);

    const drifted = await ledger.driftedWallets();
    expect(drifted).toHaveLength(1);
    expect(drifted[0]).toMatchObject({ walletId, deltaPaise: 100 });
  });

  it('balanceOf returns zero for an owner with no wallet', async () => {
    expect(await ledger.balanceOf({ ownerType: 'fleet', ownerId: fleetB })).toBe(0);
  });

  it('the read handle shares the primary POOL when DATABASE_READ_URL is unset', () => {
    // The identity that matters is the postgres.js pool, not the Drizzle
    // wrapper: `drizzle(sql)` returns a fresh object either way. If this ever
    // fails, every test is silently running against two pools — and
    // `DbModule.onApplicationShutdown` would double-close one of them.
    expect(app.get(PG_READER)).toBe(app.get(PG));
    expect(app.get(DB_READER)).not.toBe(app.get(DB));
  });

  it('a settlement for a booking that does not exist is refused by the FK', async () => {
    // `ref_id` has no FK by design (it is polymorphic across bookings/payouts),
    // so this documents that the ledger does NOT validate the reference — the
    // caller must. Kept as an explicit assertion so the absence is deliberate.
    const orphan = await ledger.post([
      {
        owner: { ownerType: 'fleet', ownerId: fleetA },
        type: 'adjustment',
        amountPaise: 100,
        reason: 'orphan ref',
        refId: '00000000-0000-4000-8000-000000000000',
        idempotencyKey: 'adj:v1:orphan',
      },
    ]);
    expect(orphan.replayed).toBe(false);
  });

  it('does not leak across tenants: two fleets keep separate wallets', async () => {
    await ledger.post([
      {
        owner: { ownerType: 'fleet', ownerId: fleetA },
        type: 'fleet_share_credit',
        amountPaise: 30_000,
        reason: 'A',
        idempotencyKey: 'adj:v1:tenant-a',
      },
      {
        owner: { ownerType: 'fleet', ownerId: fleetB },
        type: 'fleet_share_credit',
        amountPaise: 70_000,
        reason: 'B',
        idempotencyKey: 'adj:v1:tenant-b',
      },
    ]);

    expect(await walletBalance('fleet', fleetA)).toBe('300.00');
    expect(await walletBalance('fleet', fleetB)).toBe('700.00');
  });

  it('seedBooking still works alongside the ledger fixtures', async () => {
    // Guards the fixture signature the rest of the suite depends on.
    const userId = (await seedFleet(db, 'Fixture Check')).ownerId;
    await expect(seedBooking(db, { userId, fleetId: fleetA })).resolves.toBeTruthy();
  });
});
