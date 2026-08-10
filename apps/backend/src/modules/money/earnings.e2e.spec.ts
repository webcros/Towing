import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeaderFor, createTestApp } from '../../test/app';
import { seedDriver, seedFleet, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { seedCustomerBooking, seedTruck } from '../../test/fixtures';
import { LedgerService } from '../../db/ledger/ledger.service';
import { rebuildEarnings } from './earnings-projector';

describe('earnings + reports e2e (/v1/fleet/earnings, /v1/fleet/reports)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let ledger: LedgerService;
  let authA: string;
  let authB: string;
  let fleetA: string;
  let fleetB: string;
  let driverA: string;
  let driverB: string;

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
    const a = await seedFleet(db, 'Earnings Fleet A');
    const b = await seedFleet(db, 'Earnings Fleet B');
    fleetA = a.fleetId;
    fleetB = b.fleetId;
    driverA = await seedDriver(db, { fleetId: fleetA, name: 'Anita Rao' });
    driverB = await seedDriver(db, { fleetId: fleetB, name: 'Other Fleet Driver' });
    authA = await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId });
    authB = await authHeaderFor(app, { userId: b.ownerId, fleetId: b.fleetId });
  });

  /**
   * One settled §7.5 booking: ₹4,499 Band A at 80/20 → commission ₹449.90,
   * pool ₹4,049.10, driver ₹3,239.28, fleet ₹809.82.
   */
  const settle = async (
    options: { fleetId?: string; driverId?: string; at?: Date; totalPaise?: number } = {},
  ): Promise<string> => {
    const fleetId = options.fleetId ?? fleetA;
    const driverId = options.driverId ?? driverA;
    const totalPaise = options.totalPaise ?? 449_900;
    const at = options.at ?? new Date();

    const commission = Math.round(totalPaise * 0.1);
    const bookingId = await seedCustomerBooking(db, {
      fleetId,
      driverId,
      status: 'paid',
      total: (totalPaise / 100).toFixed(2),
      commissionAmount: (commission / 100).toFixed(2),
      driverPayout: ((totalPaise - commission) / 100).toFixed(2),
      createdAt: at,
    });

    await ledger.creditBookingSettlement({
      bookingId,
      totalPaise,
      band: 'A',
      driverId,
      fleet: { fleetId, driverSharePct: 80 },
    });

    await db.execute(sql`
      update wallet_transactions set created_at = ${at.toISOString()}::timestamptz
       where ref_id = ${bookingId}::uuid
    `);

    return bookingId;
  };

  const today = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

  describe('GET /v1/fleet/earnings', () => {
    it('returns totals, trend and wallet position for the current IST month', async () => {
      await settle();
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.totals).toEqual({
        jobs: 1,
        grossPaise: 449_900,
        commissionPaise: 44_990,
        poolPaise: 404_910,
        driverSharePaise: 323_928,
        fleetSharePaise: 80_982,
      });
      expect(res.body.wallet.balancePaise).toBe(80_982);
      expect(res.body.wallet.availablePaise).toBe(80_982);
      // Server-driven, so the console never hardcodes a second copy.
      expect(res.body.wallet.minPayoutPaise).toBe(100_000);
      expect(res.body.wallet.payoutAccountLinked).toBe(false);
      expect(res.body.trend).toEqual([
        { date: today(), grossPaise: 449_900, fleetSharePaise: 80_982 },
      ]);
      // Deleted on purpose: the share is per driver, so a fleet running 80/20
      // and 70/30 has no single number.
      expect(res.body).not.toHaveProperty('fleetSharePct');
    });

    it('honours an explicit from/to window', async () => {
      await settle({ at: new Date('2026-05-10T06:00:00Z') });
      await settle({ at: new Date('2026-06-10T06:00:00Z') });
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings?from=2026-05-01&to=2026-05-31')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.totals.jobs).toBe(1);
      expect(res.body.period).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    });

    it('never shows another fleet’s money', async () => {
      await settle();
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings')
        .set('Authorization', authB)
        .expect(200);

      expect(res.body.totals).toMatchObject({ jobs: 0, grossPaise: 0, fleetSharePaise: 0 });
      expect(res.body.wallet.balancePaise).toBe(0);
    });

    it('rejects an unauthenticated request', async () => {
      await request(app.getHttpServer()).get('/v1/fleet/earnings').expect(401);
    });
  });

  describe('GET /v1/fleet/earnings/split', () => {
    it('breaks one job down gross → commission → pool → legs', async () => {
      const bookingId = await settle();

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/split')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        bookingId,
        jobCode: `TW-${bookingId.slice(0, 8).toUpperCase()}`,
        driverName: 'Anita Rao',
        grossPaise: 449_900,
        commissionPaise: 44_990,
        poolPaise: 404_910,
        driverSharePaise: 323_928,
        fleetSharePaise: 80_982,
      });
      expect(res.body.nextCursor).toBeNull();
    });

    it('includes a booking whose driver takes the entire pool (100/0 split)', async () => {
      // The reason the feed is anchored on `bookings` and not on the fleet's
      // own ledger rows: at a 100/0 share there IS no fleet leg, and a
      // wallet-anchored feed would silently drop the job from the fleet's own
      // split table.
      const bookingId = await seedCustomerBooking(db, {
        fleetId: fleetA,
        driverId: driverA,
        status: 'paid',
        total: '1000.00',
        commissionAmount: '100.00',
        driverPayout: '900.00',
      });
      await ledger.creditBookingSettlement({
        bookingId,
        totalPaise: 100_000,
        band: 'A',
        driverId: driverA,
        fleet: { fleetId: fleetA, driverSharePct: 100 },
      });

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/split')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0]).toMatchObject({
        bookingId,
        driverSharePaise: 90_000,
        fleetSharePaise: 0,
      });
    });

    it('pages by keyset with a stable order across identical timestamps', async () => {
      // Same `created_at` on every booking, so ordering can only be decided by
      // the id tiebreaker — which is what `desc nulls last, id desc nulls last`
      // exists for.
      const at = new Date('2026-06-01T06:00:00Z');
      for (let i = 0; i < 5; i += 1) await settle({ at });

      const first = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/split?limit=2')
        .set('Authorization', authA)
        .expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toBeTruthy();

      const second = await request(app.getHttpServer())
        .get(`/v1/fleet/earnings/split?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
        .set('Authorization', authA)
        .expect(200);

      const firstIds = first.body.items.map((i: { bookingId: string }) => i.bookingId);
      const secondIds = second.body.items.map((i: { bookingId: string }) => i.bookingId);
      expect(secondIds).toHaveLength(2);
      expect(firstIds.filter((id: string) => secondIds.includes(id))).toEqual([]);
    });

    it('filters by driver and never leaks another fleet’s jobs', async () => {
      await settle();
      await settle({ fleetId: fleetB, driverId: driverB });

      const mine = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/split')
        .set('Authorization', authA)
        .expect(200);
      expect(mine.body.items).toHaveLength(1);
      expect(mine.body.items[0].driverName).toBe('Anita Rao');

      const filtered = await request(app.getHttpServer())
        .get(`/v1/fleet/earnings/split?driverId=${driverB}`)
        .set('Authorization', authA)
        .expect(200);
      expect(filtered.body.items).toEqual([]);
    });

    it('rejects a malformed cursor with a validation envelope', async () => {
      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/split?cursor=not-a-cursor')
        .set('Authorization', authA)
        .expect(422);
      expect(res.body.error.code).toBe('validation_failed');
    });
  });

  describe('GET /v1/fleet/earnings/statement.csv', () => {
    it('streams a statement with no customer PII', async () => {
      await settle({ at: new Date('2026-06-10T06:00:00Z') });

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/statement.csv?month=2026-06')
        .set('Authorization', authA)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('towfleet-statement-2026-06.csv');

      const [header, ...rows] = res.text.trim().split('\n');
      // §9.3.8 AC: "exports contain no customer PII beyond what invoices require".
      expect(header).toBe(
        'job_code,settled_at,driver,gross_rupees,commission_band,commission_pct,' +
          'commission_rupees,pool_rupees,driver_share_rupees,fleet_share_rupees',
      );
      for (const forbidden of ['customer', 'phone', 'mobile', 'pickup', 'address']) {
        expect(header).not.toContain(forbidden);
      }

      expect(rows).toHaveLength(1);
      expect(rows[0]).toContain('Anita Rao');
      expect(rows[0]).toContain('4499.00');
      expect(rows[0]).toContain('809.82');
    });

    it('neutralizes a formula-injecting driver name', async () => {
      const evil = await seedDriver(db, { fleetId: fleetA, name: '=cmd|calc' });
      await settle({ driverId: evil, at: new Date('2026-06-10T06:00:00Z') });

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/earnings/statement.csv?month=2026-06')
        .set('Authorization', authA)
        .expect(200);

      expect(res.text).toContain("'=cmd|calc");
      expect(res.text).not.toMatch(/,=cmd/);
    });

    it('rejects a malformed month', async () => {
      await request(app.getHttpServer())
        .get('/v1/fleet/earnings/statement.csv?month=June')
        .set('Authorization', authA)
        .expect(422);
    });
  });

  describe('GET /v1/fleet/reports', () => {
    it('groups by driver off the projection', async () => {
      await settle();
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get(`/v1/fleet/reports?groupBy=driver&from=${today()}&to=${today()}`)
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.groupBy).toBe('driver');
      expect(res.body.rows).toHaveLength(1);
      expect(res.body.rows[0]).toMatchObject({
        name: 'Anita Rao',
        jobs: 1,
        grossPaise: 449_900,
        driverSharePaise: 323_928,
        fleetSharePaise: 80_982,
      });
    });

    it('groups by period at day granularity', async () => {
      await settle({ at: new Date('2026-06-10T06:00:00Z') });
      await settle({ at: new Date('2026-06-11T06:00:00Z') });
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/reports?groupBy=period&from=2026-06-01&to=2026-06-30')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.rows.map((r: { bucket: string }) => r.bucket)).toEqual([
        '2026-06-10',
        '2026-06-11',
      ]);
      expect(res.body.granularity).toBe('day');
    });

    it('rolls the same window up to one month bucket', async () => {
      await settle({ at: new Date('2026-06-10T06:00:00Z') });
      await settle({ at: new Date('2026-06-11T06:00:00Z') });
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/reports?groupBy=period&from=2026-06-01&to=2026-06-30&granularity=month')
        .set('Authorization', authA)
        .expect(200);

      expect(res.body.rows).toHaveLength(1);
      expect(res.body.rows[0]).toMatchObject({ bucket: '2026-06-01', jobs: 2 });
    });

    it('groups by truck with period utilization and compliance counts', async () => {
      const truckId = await seedTruck(db, fleetA, { plate: 'KA-01-AA-1111' });
      await db.execute(sql`
        update drivers set assigned_truck_id = ${truckId}::uuid where id = ${driverA}::uuid
      `);
      await settle({ at: new Date('2026-06-10T06:00:00Z') });
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get('/v1/fleet/reports?groupBy=truck&from=2026-06-10&to=2026-06-19')
        .set('Authorization', authA)
        .expect(200);

      const row = res.body.rows.find((r: { plate: string }) => r.plate === 'KA-01-AA-1111');
      expect(row).toMatchObject({
        jobs: 1,
        inServiceDays: 10,
        activeDays: 1,
        // A PERIOD metric — share of in-service days with at least one job —
        // not the dashboard's instantaneous utilisation.
        utilizationPct: 10,
        grossPaise: 449_900,
      });
    });

    it('refuses an inverted or oversized window', async () => {
      await request(app.getHttpServer())
        .get('/v1/fleet/reports?groupBy=driver&from=2026-06-30&to=2026-06-01')
        .set('Authorization', authA)
        .expect(422);

      await request(app.getHttpServer())
        .get('/v1/fleet/reports?groupBy=driver&from=2020-01-01&to=2026-12-31')
        .set('Authorization', authA)
        .expect(422);
    });

    it('is fleet-scoped', async () => {
      await settle();
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get(`/v1/fleet/reports?groupBy=driver&from=${today()}&to=${today()}`)
        .set('Authorization', authB)
        .expect(200);

      expect(res.body.rows).toEqual([]);
    });

    it('streams the report as CSV', async () => {
      await settle();
      await rebuildEarnings(db, {});

      const res = await request(app.getHttpServer())
        .get(`/v1/fleet/reports/export.csv?groupBy=driver&from=${today()}&to=${today()}`)
        .set('Authorization', authA)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      const lines = res.text.trim().split('\n');
      expect(lines[0]).toBe(
        'driver,kyc_status,jobs,gross_rupees,driver_share_rupees,fleet_share_rupees,rating',
      );
      expect(lines[1]).toContain('Anita Rao');
    });
  });
});
