import type { INestApplication } from '@nestjs/common';
import { bookingCancelResponseSchema } from '@towing/api-contracts';
import { desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookingStatusHistory, bookings } from '../../db/schema';
import { createTestApp, customerAuthHeaderFor } from '../../test/app';
import { expectMatchesContract } from '../../test/contracts';
import { seedCustomer, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { seedBooking } from '../../test/fixtures';
import { closeTestRedis, flushTestRedis } from '../../test/redis';

/**
 * `POST /v1/bookings/:id/cancel` — §3.5's FREE branches.
 *
 * The chargeable tiers are computed, reported and refused: collecting a fee
 * needs a ledger entry and a driver-compensation leg, both Phase 19. Cancelling
 * for ₹0 instead would be a revenue bug nobody notices until a month's numbers
 * come out.
 */
describe('POST /v1/bookings/:id/cancel', () => {
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

  async function seedIn(
    status: (typeof bookings.$inferInsert)['status'],
    options: { minutesAgo?: number; owner?: string } = {},
  ): Promise<string> {
    const id = await seedBooking(db, { userId: options.owner ?? userId, status: 'paid' });
    await db
      .update(bookings)
      .set({
        status,
        baseFare: '999.00',
        createdAt: new Date(Date.now() - (options.minutesAgo ?? 0) * 60_000),
      })
      .where(eq(bookings.id, id));
    return id;
  }

  const cancel = (id: string, reason?: string) =>
    request(app.getHttpServer())
      .post(`/v1/bookings/${id}/cancel`)
      .set('Authorization', auth)
      .send(reason ? { reason } : {});

  describe('the free branches', () => {
    it('cancels a SEARCHING booking free, however long it has been searching', async () => {
      // §3.5: "During search cancellation is always free — the customer hasn't
      // been matched yet."
      const id = await seedIn('searching', { minutesAgo: 45 });

      const response = await cancel(id, 'Found another way').expect(200);
      expectMatchesContract(bookingCancelResponseSchema, response.body);

      expect(response.body.status).toBe('cancelled');
      expect(response.body.tier).toBe('free');
      expect(response.body.feePaise).toBe(0);
    });

    it('cancels free inside the 2-minute window after assignment', async () => {
      const id = await seedIn('assigned', { minutesAgo: 1 });
      const response = await cancel(id).expect(200);
      expect(response.body.tier).toBe('free');
    });

    it('records who cancelled, why, and a zero fee', async () => {
      const id = await seedIn('searching');
      await cancel(id, 'Changed my mind').expect(200);

      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
      expect(row!.status).toBe('cancelled');
      expect(row!.cancelledBy).toBe('customer');
      expect(row!.cancellationReason).toBe('Changed my mind');
      expect(row!.cancellationFee).toBe('0.00');
    });

    it('writes a history row through the state machine', async () => {
      const id = await seedIn('searching');
      await cancel(id, 'Changed my mind').expect(200);

      const [latest] = await db
        .select()
        .from(bookingStatusHistory)
        .where(eq(bookingStatusHistory.bookingId, id))
        .orderBy(desc(bookingStatusHistory.createdAt))
        .limit(1);

      expect(latest!.status).toBe('cancelled');
      expect(latest!.actor).toBe('customer');
      expect(latest!.note).toBe('Changed my mind');
    });

    it('frees the §3.8 slot so the customer can book again', async () => {
      const id = await seedIn('searching');
      await cancel(id).expect(200);
      // The partial unique index only covers open statuses, so a second open
      // booking is now insertable. If it were not, a cancelled trip would lock
      // a customer out permanently.
      await expect(seedIn('searching')).resolves.toBeTruthy();
    });
  });

  describe('the chargeable branches are refused, not silently zeroed', () => {
    it('409s a partial-fee cancellation and reports the fee', async () => {
      const id = await seedIn('assigned', { minutesAgo: 6 });

      const response = await cancel(id).expect(409);
      expect(response.body.error.code).toBe('cancellation_not_free');
      expect(response.body.error.details.tier).toBe('partial');
      expect(response.body.error.details.feePaise).toBe(15_000); // §3.5's ₹150

      // Nothing moved.
      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
      expect(row!.status).toBe('assigned');
    });

    it('409s a full-fare cancellation once the driver is en route', async () => {
      const id = await seedIn('en_route', { minutesAgo: 1 });

      const response = await cancel(id).expect(409);
      expect(response.body.error.details.tier).toBe('full');
      // §3.5 example C — the full base fare, from the booking's own locked fare.
      expect(response.body.error.details.feePaise).toBe(99_900);
    });
  });

  describe('illegal cancellations', () => {
    it.each(['completed', 'paid'] as const)('refuses to cancel a %s trip', async (status) => {
      // The tow happened. The remedy is a dispute or a refund — cancelling
      // would erase a job the driver is owed for.
      const id = await seedIn(status);
      await cancel(id).expect(409);
    });

    it('refuses to cancel an already-cancelled booking', async () => {
      const id = await seedIn('searching');
      await cancel(id).expect(200);
      await cancel(id).expect(409);
    });
  });

  describe('ownership', () => {
    it('404s another customer\'s booking', async () => {
      const stranger = await seedCustomer(db);
      const theirs = await seedIn('searching', { owner: stranger });

      await request(app.getHttpServer())
        .post(`/v1/bookings/${theirs}/cancel`)
        .set('Authorization', auth)
        .send({})
        .expect(404);

      const [row] = await db.select().from(bookings).where(eq(bookings.id, theirs));
      expect(row!.status).toBe('searching');
    });

    it('rejects an anonymous caller', async () => {
      const id = await seedIn('searching');
      await request(app.getHttpServer()).post(`/v1/bookings/${id}/cancel`).send({}).expect(401);
    });
  });
});
