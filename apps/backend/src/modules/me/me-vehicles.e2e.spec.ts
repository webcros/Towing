import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, customerAuthHeaderFor } from '../../test/app';
import { seedCustomer, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';

describe('me vehicles (/v1/me/vehicles)', () => {
  let app: INestApplication;
  let db: TestDatabase;

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

  it('creates, lists, updates and deletes a vehicle', async () => {
    const userId = await seedCustomer(db);
    const auth = await customerAuthHeaderFor(app, { userId });

    const created = await request(app.getHttpServer())
      .post('/v1/me/vehicles')
      .set('Authorization', auth)
      .send({ type: 'hatchback', makeModel: 'Maruti Swift', plate: 'KA 01 AB 1234' })
      .expect(201);
    expect(created.body).toMatchObject({ type: 'hatchback', makeModel: 'Maruti Swift' });

    const list = await request(app.getHttpServer())
      .get('/v1/me/vehicles')
      .set('Authorization', auth)
      .expect(200);
    expect(list.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .put(`/v1/me/vehicles/${created.body.id}`)
      .set('Authorization', auth)
      .send({ type: 'suv' })
      .expect(200);
    expect(updated.body.type).toBe('suv');

    await request(app.getHttpServer())
      .delete(`/v1/me/vehicles/${created.body.id}`)
      .set('Authorization', auth)
      .expect(204);

    const afterDelete = await request(app.getHttpServer())
      .get('/v1/me/vehicles')
      .set('Authorization', auth)
      .expect(200);
    expect(afterDelete.body).toHaveLength(0);
  });

  it('never lets one customer read, update or delete another customer\'s vehicle', async () => {
    const ownerId = await seedCustomer(db, 'Owner');
    const otherId = await seedCustomer(db, 'Other');
    const ownerAuth = await customerAuthHeaderFor(app, { userId: ownerId });
    const otherAuth = await customerAuthHeaderFor(app, { userId: otherId });

    const created = await request(app.getHttpServer())
      .post('/v1/me/vehicles')
      .set('Authorization', ownerAuth)
      .send({ type: 'sedan' })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/v1/me/vehicles/${created.body.id}`)
      .set('Authorization', otherAuth)
      .send({ type: 'bike' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/v1/me/vehicles/${created.body.id}`)
      .set('Authorization', otherAuth)
      .expect(404);

    // The owner's row must survive the other customer's failed attempts.
    const list = await request(app.getHttpServer())
      .get('/v1/me/vehicles')
      .set('Authorization', ownerAuth)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('presign -> upload -> confirm sets rcUrl, and rejects a key not scoped to this vehicle', async () => {
    const userId = await seedCustomer(db);
    const auth = await customerAuthHeaderFor(app, { userId });

    const created = await request(app.getHttpServer())
      .post('/v1/me/vehicles')
      .set('Authorization', auth)
      .send({ type: 'hatchback' })
      .expect(201);
    const vehicleId = created.body.id as string;

    const presign = await request(app.getHttpServer())
      .post(`/v1/me/vehicles/${vehicleId}/rc/presign`)
      .set('Authorization', auth)
      .expect(201);

    const { pathname, search } = new URL(presign.body.uploadUrl);
    await request(app.getHttpServer())
      .put(`${pathname}${search}`)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('rc-photo'))
      .expect(204);

    await request(app.getHttpServer())
      .post(`/v1/me/vehicles/${vehicleId}/rc/confirm`)
      .set('Authorization', auth)
      .send({ key: presign.body.key })
      .expect(204);

    const after = await request(app.getHttpServer())
      .get('/v1/me/vehicles')
      .set('Authorization', auth)
      .expect(200);
    expect(after.body[0].rcUrl).toContain(vehicleId);

    // A key presigned for a DIFFERENT vehicle (even the same owner's) must
    // not confirm here — the doc-type-scoped shape check from Phase 11
    // extends to per-resource scoping, not just per-owner.
    const otherVehicle = await request(app.getHttpServer())
      .post('/v1/me/vehicles')
      .set('Authorization', auth)
      .send({ type: 'suv' })
      .expect(201);
    const otherPresign = await request(app.getHttpServer())
      .post(`/v1/me/vehicles/${otherVehicle.body.id}/rc/presign`)
      .set('Authorization', auth)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/me/vehicles/${vehicleId}/rc/confirm`)
      .set('Authorization', auth)
      .send({ key: otherPresign.body.key })
      .expect(403);
  });
});
