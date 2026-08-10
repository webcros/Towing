import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { QUEUE, type QueuePort } from '../../common/queue/queue.port';
import { ENV, type Env } from '../../config/env';
import { verifyWebhookSignature } from './webhook-signature';
import {
  type CreatePayoutParams,
  type LinkAccountParams,
  type LinkedAccount,
  type PayoutHandle,
  type PayoutProviderPort,
  type PayoutWebhookEvent,
} from './payout-provider.port';

/**
 * The PERMANENT local-development payout provider — the same standing as
 * `DevOtpAdapter`, `LogNotificationAdapter` and `DiskStorageAdapter`.
 * `pnpm backend` + `pnpm db:seed` must demonstrate the whole payout lifecycle
 * with zero Razorpay credentials, forever.
 *
 * It is not a stub. It settles on a real timer through the real `markPaid`
 * transition, and it verifies webhook signatures with the real HMAC, so the
 * paths that matter are exercised on every local run rather than only once a
 * merchant account exists.
 *
 * `assertProductionSafety` refuses to boot production with this bound: marking
 * payouts `paid` on a timer with no bank involved would be a ledger full of
 * money nobody sent.
 */
@Injectable()
export class DevPayoutAdapter implements PayoutProviderPort {
  readonly name = 'dev';

  private readonly logger = new Logger(DevPayoutAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(QUEUE) private readonly queue: QueuePort,
  ) {}

  linkAccount(params: LinkAccountParams): Promise<LinkedAccount> {
    this.logger.log(
      `[dev] linked ${params.ownerType} ${params.ownerId} → ${maskAccount(params.accountNumber)} (${params.ifsc})`,
    );

    return Promise.resolve({
      accountId: `acc_dev_${randomUUID().slice(0, 12)}`,
      fundAccountId: `fa_dev_${randomUUID().slice(0, 12)}`,
      // Active immediately: a dev environment that parks every fleet in
      // `pending` cannot demonstrate a payout at all.
      status: 'active',
      bankName: 'Dev Test Bank',
    });
  }

  async createPayout(params: CreatePayoutParams): Promise<PayoutHandle> {
    // The acceptance time is encoded IN the reference rather than held in a
    // Map on this instance. An in-memory map is hidden state: it is lost on
    // restart (so every in-flight payout would look brand new forever) and it
    // is not shared between tasks, so whichever one happens to poll would give
    // a different answer. A self-describing ref has neither problem.
    const providerRef = `pout_dev_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;

    // Drives the REAL `markPaid` transition on a real delayed job, so the whole
    // lifecycle — request → processing → paid → alert resolve → balance — is
    // demonstrable locally with zero credentials, and exercises the production
    // code path rather than a parallel fake one.
    //
    // With `QUEUE_ENABLED=false` this simply does nothing and the payout stays
    // `processing`, which is honest: the reconciliation poll's `fetchPayout`
    // then ages it into `paid` instead.
    await this.queue.enqueue(
      'payouts.dev-settle',
      { payoutId: params.payoutId, providerRef },
      { jobId: `dev-settle:${params.payoutId}`, delayMs: this.env.PAYOUT_DEV_SETTLE_MS },
    );

    this.logger.log(
      `[dev] payout ${params.payoutId} accepted as ${providerRef} ` +
        `(₹${(params.amountPaise / 100).toFixed(2)}); settles in ${this.env.PAYOUT_DEV_SETTLE_MS}ms`,
    );

    return { providerRef, status: 'processing' };
  }

  /**
   * Ages into `paid` off the timestamp in the reference, so the reconciliation
   * poll can settle a payout even with `QUEUE_ENABLED=false` and no delayed job
   * to run — which is exactly the degraded configuration the tests use.
   */
  fetchPayout(providerRef: string): Promise<PayoutHandle> {
    const acceptedAt = acceptedAtFrom(providerRef);
    // An unparseable ref is treated as settled: it can only come from an older
    // format or a hand-written row, and leaving those in flight forever is the
    // worse failure.
    const settled = acceptedAt === null || Date.now() - acceptedAt >= this.env.PAYOUT_DEV_SETTLE_MS;
    return Promise.resolve({ providerRef, status: settled ? 'paid' : 'processing' });
  }

  /** The same HMAC the real provider uses — see `webhook-signature.ts`. */
  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    return verifyWebhookSignature(rawBody, signature, this.env.PAYOUT_WEBHOOK_SECRET);
  }

  parseWebhook(payload: unknown): PayoutWebhookEvent | null {
    return parseRazorpayPayoutWebhook(payload);
  }
}

/** Never log a full account number, not even in development. */
function maskAccount(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}

/** `pout_dev_<base36 millis>_<rand>` → millis, or null if it is not one of ours. */
function acceptedAtFrom(providerRef: string): number | null {
  const millis = Number.parseInt(providerRef.split('_')[2] ?? '', 36);
  return Number.isFinite(millis) && millis > 0 ? millis : null;
}

/**
 * Razorpay's payout webhook envelope, parsed by both adapters so a captured
 * production payload can be replayed against a dev environment verbatim.
 *
 * Shape: `{ id, event, payload: { payout: { entity: { id, status, notes,
 * failure_reason } } } }`.
 */
export function parseRazorpayPayoutWebhook(payload: unknown): PayoutWebhookEvent | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;

  const event = typeof body.event === 'string' ? body.event : null;
  if (!event || !event.startsWith('payout.')) return null;

  const entity = (
    (body.payload as Record<string, unknown> | undefined)?.payout as
      | Record<string, unknown>
      | undefined
  )?.entity as Record<string, unknown> | undefined;

  if (!entity) return null;

  const notes = (entity.notes ?? {}) as Record<string, unknown>;

  return {
    // Razorpay sends the event id in `id`; fall back to the payout reference so
    // a payload without one still dedupes on something stable rather than
    // being processed twice.
    eventId:
      typeof body.id === 'string' && body.id
        ? body.id
        : `${event}:${typeof entity.id === 'string' ? entity.id : 'unknown'}`,
    eventType: event,
    providerRef: typeof entity.id === 'string' ? entity.id : null,
    payoutId: typeof notes.payoutId === 'string' ? notes.payoutId : null,
    status: mapStatus(typeof entity.status === 'string' ? entity.status : ''),
    failureReason:
      typeof entity.failure_reason === 'string' ? entity.failure_reason : null,
  };
}

function mapStatus(raw: string): PayoutWebhookEvent['status'] {
  switch (raw) {
    case 'processed':
      return 'paid';
    case 'reversed':
    case 'failed':
    case 'cancelled':
      return 'failed';
    case 'processing':
    case 'queued':
    case 'pending':
    case 'initiated':
      return 'processing';
    default:
      // Not an error: an unrecognised status is acknowledged and left to the
      // reconciliation poll rather than retried forever by the vendor.
      return 'unknown';
  }
}
