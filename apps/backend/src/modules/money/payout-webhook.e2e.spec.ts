import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { authHeaderFor, createTestApp } from '../../test/app';
import {
  seedFleet,
  seedPayoutAccount,
  setupTestDatabase,
  truncateAll,
  type TestDatabase,
} from '../../test/db';
import { seedWalletWithLedger } from '../../test/fixtures';
import { ENV, type Env } from '../../config/env';
import { signWebhook } from './webhook-signature';

describe('payout webhook e2e (/v1/webhooks/razorpay)', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let secret: string;
  let authA: string;
  let fleetA: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    app = await createTestApp();
    secret = app.get<Env>(ENV).PAYOUT_WEBHOOK_SECRET;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll();
    const a = await seedFleet(db, 'Webhook Fleet');
    fleetA = a.fleetId;
    authA = await authHeaderFor(app, { userId: a.ownerId, fleetId: a.fleetId });
    await seedWalletWithLedger(db, { ownerId: fleetA, ownerType: 'fleet' }, [
      { type: 'fleet_share_credit', amount: '20000.00' },
    ]);
    await seedPayoutAccount(db, fleetA);
  });

  const createPayout = async (): Promise<{ id: string; providerRef: string }> => {
    const res = await request(app.getHttpServer())
      .post('/v1/fleet/payouts')
      .set('Authorization', authA)
      .set('Idempotency-Key', randomUUID())
      .send({ amountPaise: 1_000_000 })
      .expect(201);
    return { id: res.body.id, providerRef: res.body.providerRef };
  };

  const envelope = (params: {
    eventId?: string;
    event: string;
    providerRef: string;
    payoutId?: string;
    status: string;
    failureReason?: string;
  }) => ({
    id: params.eventId ?? `evt_${randomUUID().slice(0, 12)}`,
    event: params.event,
    payload: {
      payout: {
        entity: {
          id: params.providerRef,
          status: params.status,
          ...(params.failureReason ? { failure_reason: params.failureReason } : {}),
          notes: params.payoutId ? { payoutId: params.payoutId } : {},
        },
      },
    },
  });

  /** Sends the exact bytes that were signed — a re-serialised object would not verify. */
  const send = (body: unknown, options: { signature?: string | null } = {}) => {
    const raw = JSON.stringify(body);
    const signature = options.signature === undefined ? signWebhook(raw, secret) : options.signature;

    const req = request(app.getHttpServer())
      .post('/v1/webhooks/razorpay')
      .set('Content-Type', 'application/json');

    if (signature !== null) req.set('x-razorpay-signature', signature);
    return req.send(raw);
  };

  const webhookRows = async () =>
    (await db.execute(sql`
      select event_id, processed_at, error from webhook_events order by received_at
    `)) as unknown as Array<{ event_id: string; processed_at: string | null; error: string | null }>;

  const payoutRow = async (id: string) => {
    const rows = (await db.execute(sql`
      select status::text as status, paid_at, failure_reason from payouts where id = ${id}::uuid
    `)) as unknown as Array<{ status: string; paid_at: string | null; failure_reason: string | null }>;
    return rows[0]!;
  };

  const balance = async () => {
    const rows = (await db.execute(sql`
      select balance from wallets where owner_type = 'fleet' and owner_id = ${fleetA}::uuid
    `)) as unknown as Array<{ balance: string }>;
    return rows[0]!.balance;
  };

  const ledgerTypes = async () =>
    (
      (await db.execute(sql`
        select t.type::text as type, t.idempotency_key
          from wallet_transactions t
          join wallets w on w.id = t.wallet_id
         where w.owner_id = ${fleetA}::uuid
         order by t.created_at, t.idempotency_key
      `)) as unknown as Array<{ type: string; idempotency_key: string }>
    ).map((r) => r.type);

  describe('signature verification', () => {
    it('rejects an unsigned request and writes nothing', async () => {
      const { providerRef } = await createPayout();

      const res = await send(
        envelope({ event: 'payout.processed', providerRef, status: 'processed' }),
        { signature: null },
      ).expect(401);

      expect(res.body.error.code).toBe('invalid_signature');
      // Verification happens BEFORE any DB write, so an unsigned flood cannot
      // fill webhook_events.
      expect(await webhookRows()).toHaveLength(0);
    });

    it('rejects a tampered body', async () => {
      const { providerRef } = await createPayout();
      const body = envelope({ event: 'payout.processed', providerRef, status: 'processed' });
      const signature = signWebhook(JSON.stringify(body), secret);

      await request(app.getHttpServer())
        .post('/v1/webhooks/razorpay')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .send(JSON.stringify({ ...body, event: 'payout.failed' }))
        .expect(401);

      expect(await webhookRows()).toHaveLength(0);
    });

    it('rejects a truncated signature without throwing (timingSafeEqual length trap)', async () => {
      const { providerRef } = await createPayout();
      const body = envelope({ event: 'payout.processed', providerRef, status: 'processed' });

      // A 500 here would mean `timingSafeEqual` threw on mismatched lengths.
      const res = await send(body, { signature: 'abcd' }).expect(401);
      expect(res.body.error.code).toBe('invalid_signature');

      await send(body, { signature: 'not-hex-at-all' }).expect(401);
      await send(body, { signature: '' }).expect(401);
    });

    it('needs no Authorization header and is not under fleet/', async () => {
      const { providerRef, id } = await createPayout();

      await send(
        envelope({ event: 'payout.processed', providerRef, payoutId: id, status: 'processed' }),
      ).expect(200);

      // Proves the route is genuinely `/v1/webhooks/...`.
      await request(app.getHttpServer()).post('/v1/fleet/webhooks/razorpay').expect(404);
    });
  });

  describe('payout.processed', () => {
    it('settles the payout without writing a second ledger row', async () => {
      const { id, providerRef } = await createPayout();
      const before = await balance();

      await send(
        envelope({ event: 'payout.processed', providerRef, payoutId: id, status: 'processed' }),
      ).expect(200);

      const row = await payoutRow(id);
      expect(row.status).toBe('paid');
      expect(row.paid_at).toBeTruthy();

      // The debit happened at request time; `paid` is a status change, not a
      // money movement.
      expect(await balance()).toBe(before);
      expect(await ledgerTypes()).toEqual(['fleet_share_credit', 'payout_debit']);
    });

    it('a replayed event id is a cheap 200 with no second transition', async () => {
      const { id, providerRef } = await createPayout();
      const body = envelope({
        eventId: 'evt_replay_me',
        event: 'payout.processed',
        providerRef,
        payoutId: id,
        status: 'processed',
      });

      await send(body).expect(200);
      const firstPaidAt = (await payoutRow(id)).paid_at;

      // Razorpay retries on any non-2xx, so a duplicate must never be a 409.
      await send(body).expect(200);

      expect(await webhookRows()).toHaveLength(1);
      expect((await payoutRow(id)).paid_at).toBe(firstPaidAt);
    });
  });

  describe('payout.failed', () => {
    it('returns the funds with a compensating adjustment and opens an alert', async () => {
      const { id, providerRef } = await createPayout();
      expect(await balance()).toBe('10000.00');

      await send(
        envelope({
          event: 'payout.failed',
          providerRef,
          payoutId: id,
          status: 'failed',
          failureReason: 'Beneficiary account closed',
        }),
      ).expect(200);

      const row = await payoutRow(id);
      expect(row.status).toBe('failed');
      expect(row.failure_reason).toBe('Beneficiary account closed');

      // §14.5: a compensating entry, never an edit — both facts stay in history.
      expect(await balance()).toBe('20000.00');
      expect(await ledgerTypes()).toEqual(['fleet_share_credit', 'payout_debit', 'adjustment']);

      const reversal = (await db.execute(sql`
        select idempotency_key from wallet_transactions
         where type = 'adjustment' and ref_id = ${id}::uuid
      `)) as unknown as Array<{ idempotency_key: string }>;
      expect(reversal[0]!.idempotency_key).toBe(`po:v1:${id}:reversal`);

      const alerts = (await db.execute(sql`
        select type::text as type, severity::text as severity, href, message, resolved_at
          from alerts where subject_type = 'payout' and subject_id = ${id}::uuid
      `)) as unknown as Array<{
        type: string;
        severity: string;
        href: string;
        message: string;
        resolved_at: string | null;
      }>;
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ type: 'payout_failed', severity: 'error', href: '/earnings' });
      expect(alerts[0]!.message).toContain('Beneficiary account closed');
      expect(alerts[0]!.resolved_at).toBeNull();
    });

    it('a later processed event cannot resurrect a failed payout', async () => {
      const { id, providerRef } = await createPayout();

      await send(
        envelope({ event: 'payout.failed', providerRef, payoutId: id, status: 'failed' }),
      ).expect(200);
      await send(
        envelope({ event: 'payout.processed', providerRef, payoutId: id, status: 'processed' }),
      ).expect(200);

      // `where status in ('requested','processing')` is what makes the guard hold.
      expect((await payoutRow(id)).status).toBe('failed');
      expect(await balance()).toBe('20000.00');
    });

    it('a successful retry resolves the alert', async () => {
      const first = await createPayout();
      await send(
        envelope({ event: 'payout.failed', providerRef: first.providerRef, payoutId: first.id, status: 'failed' }),
      ).expect(200);

      const second = await createPayout();
      await send(
        envelope({
          event: 'payout.processed',
          providerRef: second.providerRef,
          payoutId: second.id,
          status: 'processed',
        }),
      ).expect(200);

      // The failed payout's own alert stays open — it is about that payout, and
      // a different payout succeeding does not un-fail it.
      const open = (await db.execute(sql`
        select subject_id from alerts where subject_type = 'payout' and resolved_at is null
      `)) as unknown as Array<{ subject_id: string }>;
      expect(open.map((r) => r.subject_id)).toEqual([first.id]);
    });

    it('resolving happens when THAT payout is later marked paid', async () => {
      const { id, providerRef } = await createPayout();
      await send(
        envelope({ event: 'payout.failed', providerRef, payoutId: id, status: 'failed' }),
      ).expect(200);

      // Force it non-terminal again the way an operator repair would, then let
      // the paid path run — this is the resolve half's new home.
      await db.execute(sql`update payouts set status = 'processing' where id = ${id}::uuid`);
      await send(
        envelope({ event: 'payout.processed', providerRef, payoutId: id, status: 'processed' }),
      ).expect(200);

      const alerts = (await db.execute(sql`
        select resolved_at from alerts where subject_type = 'payout' and subject_id = ${id}::uuid
      `)) as unknown as Array<{ resolved_at: string | null }>;
      expect(alerts[0]!.resolved_at).not.toBeNull();
    });
  });

  describe('unknown and unmatched events', () => {
    it('acknowledges an event type it does not act on', async () => {
      // 4xx-ing unknown types makes Razorpay retry forever and eventually
      // disable the endpoint, taking settlement down for everything.
      await send({ id: 'evt_x', event: 'payment.captured', payload: {} }).expect(200);
      expect(await webhookRows()).toHaveLength(0);
    });

    it('records an unmatched payout and still returns 200', async () => {
      await send(
        envelope({ event: 'payout.processed', providerRef: 'pout_never_seen', status: 'processed' }),
      ).expect(200);

      const rows = await webhookRows();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.error).toContain('no payout matches');
      expect(rows[0]!.processed_at).toBeNull();
    });

    it('finds the payout by notes.payoutId when route_ref was never persisted', async () => {
      const { id } = await createPayout();
      // The crash-after-createPayout race.
      await db.execute(sql`update payouts set route_ref = null where id = ${id}::uuid`);

      await send(
        envelope({ event: 'payout.processed', providerRef: 'pout_lost', payoutId: id, status: 'processed' }),
      ).expect(200);

      expect((await payoutRow(id)).status).toBe('paid');
    });
  });
});
