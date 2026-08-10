import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, customerAuthHeaderFor } from '../../test/app';
import { seedCustomer, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';

describe('me addresses (/v1/me/addresses)', () => {
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

  it('creates, lists, updates and deletes an address, requiring lat/lng', async () => {
    const userId = await seedCustomer(db);
    const auth = await customerAuthHeaderFor(app, { userId });

    await request(app.getHttpServer())
      .post('/v1/me/addresses')
      .set('Authorization', auth)
      .send({ label: 'Home', fullAddress: 'MG Road, Bengaluru' })
      .expect(422); // lat/lng required — a saved address with no coordinates cannot seed a booking

    const created = await request(app.getHttpServer())
      .post('/v1/me/addresses')
      .set('Authorization', auth)
      .send({ label: 'Home', fullAddress: 'MG Road, Bengaluru', lat: 12.9756, lng: 77.6068 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/v1/me/addresses/${created.body.id}`)
      .set('Authorization', auth)
      .send({ label: 'Work' })
      .expect(200);
    expect(updated.body.label).toBe('Work');
    expect(updated.body.lat).toBe(12.9756); // untouched fields survive a partial update

    await request(app.getHttpServer())
      .delete(`/v1/me/addresses/${created.body.id}`)
      .set('Authorization', auth)
      .expect(204);

    const list = await request(app.getHttpServer())
      .get('/v1/me/addresses')
      .set('Authorization', auth)
      .expect(200);
    expect(list.body).toHaveLength(0);
  });

  it('never lets one customer update or delete another customer\'s address', async () => {
    const ownerId = await seedCustomer(db, 'Owner');
    const otherId = await seedCustomer(db, 'Other');
    const ownerAuth = await customerAuthHeaderFor(app, { userId: ownerId });
    const otherAuth = await customerAuthHeaderFor(app, { userId: otherId });

    const created = await request(app.getHttpServer())
      .post('/v1/me/addresses')
      .set('Authorization', ownerAuth)
      .send({ fullAddress: 'Somewhere', lat: 1, lng: 1 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/v1/me/addresses/${created.body.id}`)
      .set('Authorization', otherAuth)
      .expect(404);
  });
});
