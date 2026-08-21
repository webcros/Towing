import type { INestApplication } from '@nestjs/common';
import { bookingListResponseSchema } from '@towing/api-contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookings } from '../../db/schema';
import { createTestApp, customerAuthHeaderFor } from '../../test/app';
import { expectMatchesContract } from '../../test/contracts';
import { seedCustomer, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { seedBooking } from '../../test/fixtures';
import { closeTestRedis, flushTestRedis } from '../../test/redis';

/**
 * `GET /v1/bookings` and `GET /v1/bookings/:id` (§9.1.10, §16.2).
 *
 * The detail route is the reconnect authority for every realtime surface built
 * later — §19.2's "apps poll REST for state every 10s" fallback reads it, and
 * Phase 15's own `SearchingScreen` already does.
 */
describe('reading bookings', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let userId: string;
  let auth: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  beforeEach(async () => {
    await truncateAll();
    await flushTestRedis();
    userId = await seedCustomer(db);
    auth = await customerAuthHeaderFor(app, { userId });
  });

  /** All terminal, so the §3.8 one-active index does not object to a history. */
  async function seedHistory(count: number, owner = userId): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < count; i += 1) {
      ids.push(
        await seedBooking(db, {
          userId: owner,
          status: 'paid',
          createdAt: new Date(Date.UTC(2026, 0, 1 + i, 12)),
          pickupAddress: `Pickup ${i}`,
        }),
      );
    }
    return ids;
  }

  describe('GET /v1/bookings', () => {
    it('serves the customer their own trips, newest first', async () => {
      await seedHistory(3);

      const response = await request(app.getHttpServer())
        .get('/v1/bookings')
        .set('Authorization', auth)
        .expect(200);

      expectMatchesContract(bookingListResponseSchema, response.body);
      expect(response.body.items).toHaveLength(3);

      const dates = response.body.items.map((b: { createdAt: string }) => b.createdAt);
      expect([...dates]).toEqual([...dates].sort().reverse());
    });

    it('never leaks another customer\'s trips', async () => {
      const stranger = await seedCustomer(db);
      await seedHistory(2, stranger);
      await seedHistory(1);

      const response = await request(app.getHttpServer())
        .get('/v1/bookings')
        .set('Authorization', auth)
        .expect(200);

      expect(response.body.items).toHaveLength(1);
    });

    it('paginates by cursor without repeating or skipping a row', async () => {
      const total = 7;
      await seedHistory(total);

      const seen: string[] = [];
      let cursor: string | null = null;

      for (let page = 0; page < 10; page += 1) {
        const url: string = cursor
          ? `/v1/bookings?limit=3&cursor=${encodeURIComponent(cursor)}`
          : '/v1/bookings?limit=3';
        const response = await request(app.getHttpServer())
          .get(url)
          .set('Authorization', auth)
          .expect(200);

        seen.push(...response.body.items.map((b: { id: string }) => b.id));
        cursor = response.body.nextCursor;
        if (!cursor) break;
      }

      expect(seen).toHaveLength(total);
      expect(new Set(seen).size).toBe(total);
    });

    it('is stable when a row is inserted mid-pagination', async () => {
      // Keyset, not offset: a booking created between two pages must not shunt
      // an unseen row past the window. With OFFSET it would.
      const ids = await seedHistory(5);

      const first = await request(app.getHttpServer())
        .get('/v1/bookings?limit=2')
        .set('Authorization', auth)
        .expect(200);

      await seedBooking(db, { userId, status: 'paid', createdAt: new Date() });

      const second = await request(app.getHttpServer())
        .get(`/v1/bookings?limit=10&cursor=${encodeURIComponent(first.body.nextCursor)}`)
        .set('Authorization', auth)
        .expect(200);

      const seen = [
        ...first.body.items.map((b: { id: string }) => b.id),
        ...second.body.items.map((b: { id: string }) => b.id),
      ];
      expect(new Set(seen).size).toBe(seen.length);
      // Every original row is accounted for exactly once.
      for (const id of ids) expect(seen).toContain(id);
    });

    it('rejects a malformed cursor rather than ignoring it', async () => {
      await request(app.getHttpServer())
        .get('/v1/bookings?cursor=not-a-cursor')
        .set('Authorization', auth)
        .expect(422);
    });
  });

  describe('GET /v1/bookings/:id', () => {
    it('serves the detail with money in paise and ISO timestamps', async () => {
      const id = (await seedHistory(1))[0]!;

      const response = await request(app.getHttpServer())
        .get(`/v1/bookings/${id}`)
        .set('Authorization', auth)
        .expect(200);

      expect(response.body.id).toBe(id);
      expect(typeof response.body.breakdown.totalPaise).toBe('number');
      expect(response.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(response.body.reference).toMatch(/^TW-[0-9A-F]{8}$/);
    });

    it('404s another customer\'s booking rather than 403ing it', async () => {
      // A 403 confirms the id exists. For a resource keyed by a guessable-ish
      // uuid that is a small leak, and there is no reason to give it away.
      const stranger = await seedCustomer(db);
      const theirs = (await seedHistory(1, stranger))[0]!;

      await request(app.getHttpServer())
        .get(`/v1/bookings/${theirs}`)
        .set('Authorization', auth)
        .expect(404);
    });

    it('reports otpAvailable per §9.1.7', async () => {
      const id = (await seedHistory(1))[0]!;

      const searching = await db
        .update(bookings)
        .set({ status: 'searching' })
        .where(eq(bookings.id, id))
        .returning({ id: bookings.id });
      expect(searching).toHaveLength(1);

      const before = await request(app.getHttpServer())
        .get(`/v1/bookings/${id}`)
        .set('Authorization', auth)
        .expect(200);
      expect(before.body.otpAvailable).toBe(false);

      await db.update(bookings).set({ status: 'assigned' }).where(eq(bookings.id, id));

      const after = await request(app.getHttpServer())
        .get(`/v1/bookings/${id}`)
        .set('Authorization', auth)
        .expect(200);
      expect(after.body.otpAvailable).toBe(true);
    });

    it('404s an unknown id and 422s a non-uuid', async () => {
      await request(app.getHttpServer())
        .get('/v1/bookings/11111111-1111-4111-8111-111111111111')
        .set('Authorization', auth)
        .expect(404);

      await request(app.getHttpServer())
        .get('/v1/bookings/nonsense')
        .set('Authorization', auth)
        .expect(422);
    });

    it('rejects an anonymous caller', async () => {
      const id = (await seedHistory(1))[0]!;
      await request(app.getHttpServer()).get(`/v1/bookings/${id}`).expect(401);
    });
  });
});
