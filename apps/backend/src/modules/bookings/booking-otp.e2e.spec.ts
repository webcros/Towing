import type { INestApplication } from '@nestjs/common';
import { bookingOtpResponseSchema } from '@towing/api-contracts';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { bookings } from '../../db/schema';
import { createTestApp, customerAuthHeaderFor } from '../../test/app';
import { expectMatchesContract } from '../../test/contracts';
import { seedCustomer, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { seedBooking } from '../../test/fixtures';
import { closeTestRedis, flushTestRedis } from '../../test/redis';
import { digest } from '../auth/otp.util';
import { BookingOtpService } from './booking-otp.service';

/**
 * `GET /v1/bookings/:id/otp` (§9.1.7).
 *
 * NOTHING CAN REACH `assigned` IN PHASE 15 — dispatch is Phase 17 — so every
 * booking here is put into that state directly. That is the honest way to test
 * a route whose precondition does not exist yet, and it is also why the route
 * always 409s in real use for now.
 */
describe('GET /v1/bookings/:id/otp', () => {
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

  async function seedAssigned(owner = userId): Promise<string> {
    const id = await seedBooking(db, { userId: owner, status: 'paid' });
    await db
      .update(bookings)
      .set({ status: 'assigned', bookingOtpHash: digest('000000'), otpExpiresAt: new Date(0) })
      .where(eq(bookings.id, id));
    return id;
  }

  const fetchOtp = (id: string) =>
    request(app.getHttpServer()).get(`/v1/bookings/${id}/otp`).set('Authorization', auth);

  describe('§9.1.7 — never before assignment', () => {
    it.each(['searching', 'no_drivers_found', 'cancelled'] as const)('409s while %s', async (status) => {
      const id = await seedBooking(db, { userId, status: 'paid' });
      await db.update(bookings).set({ status }).where(eq(bookings.id, id));

      const response = await fetchOtp(id).expect(409);
      expect(response.body.error.code).toBe('otp_not_available');
    });

    it.each(['assigned', 'en_route', 'arrived', 'in_progress'] as const)(
      'serves a code once %s',
      async (status) => {
        const id = await seedAssigned();
        await db.update(bookings).set({ status }).where(eq(bookings.id, id));

        const response = await fetchOtp(id).expect(200);
        expectMatchesContract(bookingOtpResponseSchema, response.body);
        expect(response.body.code).toMatch(/^\d{6}$/);
      },
    );
  });

  describe('the code and its window', () => {
    it('stores only a digest — the row never holds the code', async () => {
      const id = await seedAssigned();
      const { body } = await fetchOtp(id).expect(200);

      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
      expect(row!.bookingOtpHash).not.toBe(body.code);
      expect(row!.bookingOtpHash).toBe(digest(body.code));
      expect(row!.bookingOtpHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('sets a 30-minute window on first retrieval', async () => {
      const id = await seedAssigned();
      const before = Date.now();
      const { body } = await fetchOtp(id).expect(200);

      const expiry = new Date(body.expiresAt).getTime();
      expect(expiry).toBeGreaterThanOrEqual(before + BookingOtpService.WINDOW_MS - 5_000);
      expect(expiry).toBeLessThanOrEqual(Date.now() + BookingOtpService.WINDOW_MS + 5_000);
    });

    it('returns the SAME code when read again inside the window', async () => {
      // The case that forced the Redis-backed read path: the customer is
      // holding the code out to a driver while their screen refetches in the
      // background. Rotating there would invalidate the code being read aloud.
      const id = await seedAssigned();
      const first = await fetchOtp(id).expect(200);
      const second = await fetchOtp(id).expect(200);

      expect(second.body.code).toBe(first.body.code);
      expect(second.body.expiresAt).toBe(first.body.expiresAt);
    });

    it('ROTATES once the window has lapsed, and restarts the clock', async () => {
      const id = await seedAssigned();
      const first = await fetchOtp(id).expect(200);

      // §9.1.7's expiry, reached without waiting half an hour.
      await db
        .update(bookings)
        .set({ otpExpiresAt: new Date(Date.now() - 1_000) })
        .where(eq(bookings.id, id));

      const second = await fetchOtp(id).expect(200);
      expect(second.body.code).not.toBe(first.body.code);
      expect(new Date(second.body.expiresAt).getTime()).toBeGreaterThan(
        new Date(first.body.expiresAt).getTime(),
      );

      // …and the digest tracks the NEW code, so the old one can no longer start
      // the job.
      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
      expect(row!.bookingOtpHash).toBe(digest(second.body.code));
      expect(row!.bookingOtpHash).not.toBe(digest(first.body.code));
    });

    it('resets the attempt cap when it rotates', async () => {
      const id = await seedAssigned();
      await db
        .update(bookings)
        .set({ otpAttempts: 4, otpExpiresAt: new Date(Date.now() - 1_000) })
        .where(eq(bookings.id, id));

      await fetchOtp(id).expect(200);

      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
      // A customer must not be locked out of a code they were just handed.
      expect(row!.otpAttempts).toBe(0);
    });

    it('recovers if the readable copy is lost mid-window', async () => {
      const id = await seedAssigned();
      const first = await fetchOtp(id).expect(200);

      // Redis flushed / evicted while the row still says the window is live.
      await flushTestRedis();

      const second = await fetchOtp(id).expect(200);
      expect(second.body.code).toMatch(/^\d{6}$/);
      // Whatever it returns must be the code the row will verify against —
      // stranding a customer whose driver is standing in front of them is the
      // one outcome that is not acceptable here.
      const [row] = await db.select().from(bookings).where(eq(bookings.id, id));
      expect(row!.bookingOtpHash).toBe(digest(second.body.code));
      expect(second.body.code).not.toBe(first.body.code);
    });
  });

  describe('ownership', () => {
    it('404s another customer\'s OTP', async () => {
      const stranger = await seedCustomer(db);
      const theirs = await seedAssigned(stranger);

      await request(app.getHttpServer())
        .get(`/v1/bookings/${theirs}/otp`)
        .set('Authorization', auth)
        .expect(404);
    });

    it('rejects an anonymous caller', async () => {
      const id = await seedAssigned();
      await request(app.getHttpServer()).get(`/v1/bookings/${id}/otp`).expect(401);
    });
  });
});
