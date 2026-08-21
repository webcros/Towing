import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { NotificationService } from '../../common/notifications/notification.service';
import { createTestApp, customerAuthHeaderFor, driverAuthHeaderFor } from '../../test/app';
import {
  seedCustomer,
  seedDriver,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';

let app: INestApplication;
let db: TestDatabase;
let emitter: NotificationService;

beforeAll(async () => {
  db = await setupTestDatabase();
  app = await createTestApp();
  emitter = app.get(NotificationService);
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateAll();
});

async function seedNotifications(driverId: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    await emitter.emit('driver.kyc.request_info', {
      driverId,
      driverName: 'Test Driver',
      reason: `Please resubmit document ${i}`,
      auditId: crypto.randomUUID(),
    });
  }
}

describe('notification centre', () => {
  it('lists a driver’s own notifications, newest first', async () => {
    const driverId = await seedDriver(db);
    await seedNotifications(driverId, 3);

    const res = await request(app.getHttpServer())
      .get('/v1/driver/notifications')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
      .expect(200);

    expect(res.body.items).toHaveLength(3);
    expect(res.body.nextCursor).toBeNull();
    const timestamps = res.body.items.map((i: { createdAt: string }) => i.createdAt);
    expect([...timestamps].sort().reverse()).toEqual(timestamps);
  });

  it('never leaks another subject’s notifications', async () => {
    const mine = await seedDriver(db, { name: 'Mine' });
    const theirs = await seedDriver(db, { name: 'Theirs' });
    await seedNotifications(theirs, 2);

    const res = await request(app.getHttpServer())
      .get('/v1/driver/notifications')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId: mine }))
      .expect(200);

    expect(res.body.items).toEqual([]);
  });

  it('pages by keyset cursor without repeating or dropping a row', async () => {
    const driverId = await seedDriver(db);
    await seedNotifications(driverId, 5);
    const auth = await driverAuthHeaderFor(app, { driverId });

    const first = await request(app.getHttpServer())
      .get('/v1/driver/notifications?limit=2')
      .set('Authorization', auth)
      .expect(200);

    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await request(app.getHttpServer())
      .get(`/v1/driver/notifications?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Authorization', auth)
      .expect(200);

    const firstIds = first.body.items.map((i: { id: string }) => i.id);
    const secondIds = second.body.items.map((i: { id: string }) => i.id);
    expect(secondIds).toHaveLength(2);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
  });

  it('counts and clears unread', async () => {
    const driverId = await seedDriver(db);
    await seedNotifications(driverId, 3);
    const auth = await driverAuthHeaderFor(app, { driverId });

    const before = await request(app.getHttpServer())
      .get('/v1/driver/notifications/unread-count')
      .set('Authorization', auth)
      .expect(200);
    expect(before.body.unread).toBe(3);

    // No `ids` means mark everything — one route, not a separate /read-all.
    const marked = await request(app.getHttpServer())
      .post('/v1/driver/notifications/read')
      .set('Authorization', auth)
      .send({})
      .expect(201);

    expect(marked.body.markedRead).toBe(3);
    expect(marked.body.unread).toBe(0);
  });

  it('marks only the ids given', async () => {
    const driverId = await seedDriver(db);
    await seedNotifications(driverId, 3);
    const auth = await driverAuthHeaderFor(app, { driverId });

    const list = await request(app.getHttpServer())
      .get('/v1/driver/notifications')
      .set('Authorization', auth)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/v1/driver/notifications/read')
      .set('Authorization', auth)
      .send({ ids: [list.body.items[0].id] })
      .expect(201);

    expect(res.body.markedRead).toBe(1);
    expect(res.body.unread).toBe(2);
  });

  it('cannot mark another subject’s notification read by supplying its id', async () => {
    const mine = await seedDriver(db, { name: 'Mine' });
    const theirs = await seedDriver(db, { name: 'Theirs' });
    await seedNotifications(theirs, 1);

    const theirList = await request(app.getHttpServer())
      .get('/v1/driver/notifications')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId: theirs }))
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/v1/driver/notifications/read')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId: mine }))
      .send({ ids: [theirList.body.items[0].id] })
      .expect(201);

    // The ids are a FILTER, never an authorisation — the subject scope is in
    // the WHERE regardless of what was passed.
    expect(res.body.markedRead).toBe(0);

    const stillUnread = await request(app.getHttpServer())
      .get('/v1/driver/notifications/unread-count')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId: theirs }))
      .expect(200);
    expect(stillUnread.body.unread).toBe(1);
  });

  it('serves the customer half at /me with the same shape', async () => {
    const userId = await seedCustomer(db);
    const auth = await customerAuthHeaderFor(app, { userId });

    const res = await request(app.getHttpServer())
      .get('/v1/me/notifications')
      .set('Authorization', auth)
      .expect(200);

    expect(res.body).toEqual({ items: [], nextCursor: null });

    const count = await request(app.getHttpServer())
      .get('/v1/me/notifications/unread-count')
      .set('Authorization', auth)
      .expect(200);
    expect(count.body.unread).toBe(0);
  });

  it('is reachable by an unapproved driver', async () => {
    // The person a KYC rejection is FOR is by definition not approved. Gating
    // the centre on approval would hide the message explaining why.
    const driverId = await seedDriver(db, { kycStatus: 'rejected' });
    await seedNotifications(driverId, 1);

    const res = await request(app.getHttpServer())
      .get('/v1/driver/notifications')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId, kycStatus: 'rejected' }))
      .expect(200);

    expect(res.body.items).toHaveLength(1);
  });
});

describe('notification preferences', () => {
  it('returns product defaults for a subject who has never set them', async () => {
    const userId = await seedCustomer(db);

    const res = await request(app.getHttpServer())
      .get('/v1/me/notification-prefs')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .expect(200);

    expect(res.body).toEqual({ promotions: false, weeklySummary: true });
  });

  it('merges a partial update rather than replacing the object', async () => {
    const driverId = await seedDriver(db);
    const auth = await driverAuthHeaderFor(app, { driverId });

    await request(app.getHttpServer())
      .put('/v1/driver/notification-prefs')
      .set('Authorization', auth)
      .send({ promotions: true })
      .expect(200);

    const res = await request(app.getHttpServer())
      .put('/v1/driver/notification-prefs')
      .set('Authorization', auth)
      .send({ weeklySummary: false })
      .expect(200);

    // A PUT from an older client that does not know about a newer key must not
    // blank it.
    expect(res.body).toEqual({ promotions: true, weeklySummary: false });
  });

  it('rejects an empty update', async () => {
    const userId = await seedCustomer(db);

    await request(app.getHttpServer())
      .put('/v1/me/notification-prefs')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send({})
      .expect(422);
  });

  it('keeps the two realms’ preferences separate', async () => {
    const userId = await seedCustomer(db);
    const driverId = await seedDriver(db);

    await request(app.getHttpServer())
      .put('/v1/me/notification-prefs')
      .set('Authorization', await customerAuthHeaderFor(app, { userId }))
      .send({ promotions: true })
      .expect(200);

    const driverPrefs = await request(app.getHttpServer())
      .get('/v1/driver/notification-prefs')
      .set('Authorization', await driverAuthHeaderFor(app, { driverId }))
      .expect(200);

    expect(driverPrefs.body.promotions).toBe(false);
  });
});
