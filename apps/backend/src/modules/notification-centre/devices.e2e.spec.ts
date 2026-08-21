import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { DeviceRegistryService } from '../../common/notifications/device-registry.service';
import { devices } from '../../db/schema/devices';
import {
  createTestApp,
  customerAuthHeaderFor,
  driverAuthHeaderFor,
} from '../../test/app';
import {
  seedCustomer,
  seedDriver,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';

let app: INestApplication;
let db: TestDatabase;

const INSTALL_A = 'install-aaaaaaaa';
const INSTALL_B = 'install-bbbbbbbb';

beforeAll(async () => {
  db = await setupTestDatabase();
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll();
});

function registerBody(overrides: Record<string, unknown> = {}) {
  return {
    installationId: INSTALL_A,
    pushToken: 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]',
    platform: 'android',
    appVersion: '1.0.0',
    ...overrides,
  };
}

describe('device registration', () => {
  it('registers a customer device under subject_type "user"', async () => {
    const userId = await seedCustomer(db);
    const auth = await customerAuthHeaderFor(app, { userId });

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', auth)
      .send(registerBody())
      .expect(201);

    const rows = await db.select().from(devices).where(eq(devices.subjectId, userId));
    expect(rows).toHaveLength(1);
    // The spelling that matters: `devices` shipped in 0008 as the only
    // polymorphic table using 'customer'; migration 0010 normalised it to
    // 'user' to match login_challenges/social_identities/consent_records. If
    // this ever reads 'customer' again, every customer push resolves to zero
    // targets and is written `skipped/no_push_target` — a code path that
    // reviews as finished and silently never delivers.
    expect(rows[0]!.subjectType).toBe('user');
    expect(rows[0]!.revokedAt).toBeNull();
  });

  it('updates rather than duplicates when the push token rotates', async () => {
    const driverId = await seedDriver(db, { kycStatus: 'pending' });
    const auth = await driverAuthHeaderFor(app, { driverId, kycStatus: 'pending' });

    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', auth)
      .send(registerBody({ pushToken: 'ExponentPushToken[first]' }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', auth)
      .send(registerBody({ pushToken: 'ExponentPushToken[second]' }))
      .expect(201);

    const rows = await db.select().from(devices).where(eq(devices.subjectId, driverId));
    // ONE row, not two. Expo tokens rotate; without the stable installation id
    // every rotation would insert another row and this driver would receive
    // every notification twice, then three times.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.pushToken).toBe('ExponentPushToken[second]');
  });

  it('lets one handset hold a customer and a driver registration at once', async () => {
    const userId = await seedCustomer(db);
    const driverId = await seedDriver(db, { kycStatus: 'approved' });

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send(registerBody({ pushToken: 'ExponentPushToken[customer]' }))
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
      .send(registerBody({ pushToken: 'ExponentPushToken[driver]' }))
      .expect(201);

    // The same person books tows and drives — `users.mobile` and
    // `drivers.mobile` are already independent unique keys, and a device
    // registry unique on installation_id alone would have made this impossible.
    const rows = await db.select().from(devices).where(eq(devices.installationId, INSTALL_A));
    expect(rows).toHaveLength(2);
  });

  it('revokes the previous owner when a token is reassigned on a shared handset', async () => {
    const driverA = await seedDriver(db, { name: 'Driver A' });
    const driverB = await seedDriver(db, { name: 'Driver B' });
    const token = 'ExponentPushToken[shared-depot-phone]';

    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId: driverA }))
      .send(registerBody({ pushToken: token }))
      .expect(201);

    // Driver A never logged out cleanly — the app was killed, or the phone was
    // handed over. Driver B signs in on the same handset and Expo mints them
    // the same token, because a push token addresses the DEVICE.
    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId: driverB }))
      .send(registerBody({ installationId: INSTALL_B, pushToken: token }))
      .expect(201);

    const [rowA] = await db.select().from(devices).where(eq(devices.subjectId, driverA));
    const [rowB] = await db.select().from(devices).where(eq(devices.subjectId, driverB));

    // Without this, driver A's payout and KYC notifications render on driver
    // B's lock screen — visible without unlocking anything.
    expect(rowA!.revokedAt).not.toBeNull();
    expect(rowA!.pushToken).toBeNull();
    expect(rowB!.pushToken).toBe(token);
    expect(rowB!.revokedAt).toBeNull();
  });

  it('registers with a null token when the OS permission was denied', async () => {
    const userId = await seedCustomer(db);

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send(registerBody({ pushToken: null }))
      .expect(201);

    const [row] = await db.select().from(devices).where(eq(devices.subjectId, userId));
    // The row is still worth having — app version, last-seen — and it flips to
    // a real token if permission is granted later without the client needing
    // to know whether it is inserting or updating.
    expect(row!.pushToken).toBeNull();
  });

  it('unregisters on logout and un-revokes on the next sign-in', async () => {
    const userId = await seedCustomer(db);
    const auth = await customerAuthHeaderFor(app, { userId });

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', auth)
      .send(registerBody())
      .expect(201);

    await request(app.getHttpServer())
      .delete('/v1/me/devices')
      .set('Authorization', auth)
      .send({ installationId: INSTALL_A })
      .expect(204);

    const [revoked] = await db.select().from(devices).where(eq(devices.subjectId, userId));
    expect(revoked!.revokedAt).not.toBeNull();
    expect(revoked!.pushToken).toBeNull();

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', auth)
      .send(registerBody())
      .expect(201);

    const rows = await db.select().from(devices).where(eq(devices.subjectId, userId));
    // Signing back in on the same handset is the ordinary case, not an attack.
    expect(rows).toHaveLength(1);
    expect(rows[0]!.revokedAt).toBeNull();
  });

  it('unregistering an unknown installation is a no-op, not a 404', async () => {
    const userId = await seedCustomer(db);

    await request(app.getHttpServer())
      .delete('/v1/me/devices')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send({ installationId: 'install-never-seen' })
      .expect(204);
  });

  it('refuses an unauthenticated registration', async () => {
    await request(app.getHttpServer()).post('/v1/me/devices').send(registerBody()).expect(401);
  });

  it('refuses a driver token on the customer route and vice versa', async () => {
    const driverId = await seedDriver(db);
    const userId = await seedCustomer(db);

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
      .send(registerBody())
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send(registerBody())
      .expect(403);
  });

  it('rejects a registration with no installation id', async () => {
    const userId = await seedCustomer(db);

    await request(app.getHttpServer())
      .post('/v1/me/devices')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send({ pushToken: 'x', platform: 'ios' })
      .expect(422);
  });

  it('keeps a driver device revoked after suspension', async () => {
    const driverId = await seedDriver(db, { kycStatus: 'approved' });

    await request(app.getHttpServer())
      .post('/v1/driver/devices')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
      .send(registerBody())
      .expect(201);

    const registry = app.get(DeviceRegistryService);
    await registry.revokeAllForSubject('driver', driverId, 'kyc_suspended');

    const [row] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.subjectId, driverId), eq(devices.subjectType, 'driver')));

    // Invariant 73: a push token outlives the session on its handset, so a
    // session ending by any route — not just an explicit logout — has to take
    // the token with it.
    expect(row!.revokedAt).not.toBeNull();
    expect(row!.revokedReason).toBe('kyc_suspended');
  });
});
