import type { INestApplication } from '@nestjs/common';
import {
  alertsListResponseSchema,
  dashboardSummarySchema,
  driversListResponseSchema,
  earningsSummarySchema,
  fleetSettingsSchema,
  jobsListResponseSchema,
  payoutsListResponseSchema,
  positionsSnapshotSchema,
  reportResponseSchema,
  splitsListResponseSchema,
  trucksListResponseSchema,
} from '@towing/api-contracts';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { authHeaderFor, createTestApp } from '../test/app';
import {
  seedDriver,
  seedFleet,
  seedPayoutAccount,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../test/db';
import { seedBooking, seedTruck, seedWalletWithLedger } from '../test/fixtures';
import { closeTestRedis } from '../test/redis';
import { expectMatchesContract } from './contracts';

/**
 * Every fleet read endpoint, asserted against the schema its client parses.
 *
 * Until now nothing checked this in either direction: the backend built its
 * responses by hand and the console trusted them, with `@towing/api-contracts`
 * agreeing with both only because a human kept it so. A type is no help — the
 * DTOs are assembled from SQL rows through `as` casts and raw `db.execute`, and
 * an extra key is invisible to TypeScript by construction.
 *
 * One table rather than an assertion scattered through each module's spec, so
 * that reading this file tells you what is covered — and a completeness guard
 * below so the table cannot quietly rot as routes are added.
 */
/** `/fleet/reports` requires an explicit IST date range; any valid one will do. */
const RANGE = 'from=2026-01-01&to=2026-12-31';

describe('response contracts', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let auth: string;
  let fleetId: string;

  const ROUTES: Array<{ path: string; schema: z.ZodType }> = [
    { path: '/v1/fleet/dashboard', schema: dashboardSummarySchema },
    { path: '/v1/fleet/trucks', schema: trucksListResponseSchema },
    { path: '/v1/fleet/drivers', schema: driversListResponseSchema },
    { path: '/v1/fleet/jobs', schema: jobsListResponseSchema },
    { path: '/v1/fleet/alerts', schema: alertsListResponseSchema },
    { path: '/v1/fleet/earnings', schema: earningsSummarySchema },
    { path: '/v1/fleet/earnings/split', schema: splitsListResponseSchema },
    { path: '/v1/fleet/payouts', schema: payoutsListResponseSchema },
    { path: '/v1/fleet/settings', schema: fleetSettingsSchema },
    { path: '/v1/fleet/realtime/positions', schema: positionsSnapshotSchema },
    // All three arms of the discriminated union — a union is only as checked as
    // its least-exercised member.
    { path: `/v1/fleet/reports?groupBy=truck&${RANGE}`, schema: reportResponseSchema },
    { path: `/v1/fleet/reports?groupBy=driver&${RANGE}`, schema: reportResponseSchema },
    { path: `/v1/fleet/reports?groupBy=period&${RANGE}`, schema: reportResponseSchema },
  ];

  beforeAll(async () => {
    db = await setupTestDatabase();
    await truncateAll();
    app = await createTestApp();

    // Real data, not an empty fleet: an empty list matches almost any schema,
    // so a fleet with nothing in it would make this whole file vacuous.
    const fleet = await seedFleet(db, 'Contract Fleet');
    fleetId = fleet.fleetId;
    auth = await authHeaderFor(app, { userId: fleet.ownerId, fleetId });

    await seedTruck(db, fleetId, { plate: 'KA-51-CT-0001' });
    const driverId = await seedDriver(db, { fleetId });
    await seedBooking(db, { userId: fleet.ownerId, fleetId, driverId, status: 'paid' });
    await seedPayoutAccount(db, fleetId);
    await seedWalletWithLedger(db, { ownerType: 'fleet', ownerId: fleetId }, [
      { type: 'fleet_share_credit', amount: '5000.00' },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  for (const route of ROUTES) {
    it(`GET ${route.path} matches its contract`, async () => {
      const res = await request(app.getHttpServer())
        .get(route.path)
        .set('Authorization', auth)
        .expect(200);

      expectMatchesContract(route.schema, res.body);
    });
  }

  /**
   * The guard that stops the table above from rotting.
   *
   * A new fleet read endpoint added without a contract assertion is exactly the
   * kind of omission nobody notices, because everything still passes. This walks
   * the routes Express actually registered and demands each one be accounted
   * for — either covered, or explicitly excluded with a reason.
   */
  it('covers every registered fleet GET route', () => {
    const registered = registeredGetPaths(app).filter(
      (path) => path.startsWith('/v1/fleet/') && !EXCLUDED.has(path),
    );

    // Without this the guard is worthless: if Express ever moves its router
    // internals, `registeredGetPaths` returns [] and every future uncovered
    // route passes silently. Failing loudly on an empty walk is the difference
    // between a guard and a comment.
    expect(registered.length).toBeGreaterThan(5);

    const covered = new Set(ROUTES.map((route) => route.path.split('?')[0]));
    const uncovered = registered.filter((path) => !covered.has(path));

    expect(uncovered).toEqual([]);
  });
});

/**
 * Routes with no response schema, named individually so the guard cannot be
 * satisfied by a wildcard nobody revisits.
 */
const EXCLUDED = new Set([
  // CSV downloads — a byte stream, not a DTO. Their shape is asserted in the
  // module specs that own them (no customer column in the statement, formula
  // injection neutralised).
  '/v1/fleet/jobs/export.csv',
  '/v1/fleet/earnings/statement.csv',
  '/v1/fleet/reports/export.csv',
  '/v1/fleet/trucks/bulk/template.csv',
  '/v1/fleet/trucks/bulk/:importId/errors.csv',
  // Bulk import status: covered by imports.e2e.spec.ts against
  // `truckImportSchema`, which needs an import to exist first.
  '/v1/fleet/trucks/bulk',
  '/v1/fleet/trucks/bulk/:importId',
  // Session identity, asserted in the auth specs.
  '/v1/fleet/auth/me',
  // Development-only OTP echo (`AUTH_DEV_OTP_ECHO`, and production refuses to
  // boot with it set). It has no contract schema ON PURPOSE: publishing one in
  // `@towing/api-contracts` would advertise to every client a route that must
  // never exist in production. Its own guard rails are in dev-otp.e2e.spec.ts.
  '/v1/fleet/auth/dev/otp',
]);

/** Express 5 keeps the registered layers on `router.stack`. */
function registeredGetPaths(app: INestApplication): string[] {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack?: RouterLayer[] };
  };

  const stack = instance.router?.stack ?? [];
  const paths = new Set<string>();

  for (const layer of stack) {
    if (!layer.route || layer.route.methods?.get !== true) continue;
    for (const path of asArray(layer.route.path)) paths.add(path);
  }

  return [...paths];
}

interface RouterLayer {
  route?: { path?: string | string[]; methods?: Record<string, boolean> };
}

function asArray(value: string | string[] | undefined): string[] {
  if (typeof value === 'string') return [value];
  return Array.isArray(value) ? value : [];
}
