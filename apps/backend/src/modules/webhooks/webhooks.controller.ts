import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ErrorCodes } from '@towing/api-contracts';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ApiException } from '../../common/errors/api-exception';
import { SkipThrottling } from '../../common/throttling/throttler.config';
import { DB, type Database } from '../../db/db.module';
import { PAYOUT_PROVIDER, type PayoutProviderPort } from '../money/payout-provider.port';
import { PayoutsService } from '../money/payouts.service';

/**
 * Vendor webhooks (§19.3: "signature-verified, idempotent, and replayable").
 *
 * **Deliberately NOT under `fleet/`, and with no `JwtAuthGuard`,
 * `FleetScopeGuard` or `@CurrentFleet()`.** Razorpay has no session and cannot
 * be asked to get one; the signature is the authentication.
 *
 * `@SkipThrottling()` for the same reason: a legitimate burst of settlement
 * events must not be rate-limited into retries, and HMAC verification rejects
 * an unsigned request in microseconds before any database work — a better gate
 * than a counter.
 *
 * ⚠ It used to say `@SkipThrottle()`, which had never skipped anything: the
 * library's decorator defaults to `{ default: true }` and the guard matches
 * skip metadata per throttler name, so with buckets named `reads`/`money`/… it
 * matched none of them. Harmless while the tracker was a shared IP and the key
 * included the handler; genuinely dangerous once per-tenant keying put every
 * unauthenticated caller — i.e. all of Razorpay — into one bucket.
 */
@Controller('webhooks')
@SkipThrottling()
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PAYOUT_PROVIDER) private readonly provider: PayoutProviderPort,
    private readonly payouts: PayoutsService,
  ) {}

  @Post('razorpay')
  @HttpCode(HttpStatus.OK)
  async razorpay(
    @Req() request: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature?: string,
  ): Promise<{ received: boolean }> {
    // `rawBody` needs `NestFactory.create(AppModule, { rawBody: true })` — and
    // the same option in BOTH factories in `src/test/app.ts`. Forget the test
    // one and this surfaces as a baffling 401.
    const raw = request.rawBody;
    if (!raw) {
      throw new ApiException(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCodes.INTERNAL,
        'Raw body capture is not enabled — the webhook signature cannot be verified',
      );
    }

    // 1. Verify BEFORE any database write. An unsigned request must not be able
    //    to fill `webhook_events` with rows.
    if (!signature || !this.provider.verifyWebhook(raw, signature)) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        ErrorCodes.INVALID_SIGNATURE,
        'Webhook signature verification failed',
      );
    }

    // 2. Parse from the RAW bytes, not `request.body`. One source of truth for
    //    what was signed; no question about parser mutation in between.
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      throw ApiException.validation('Webhook body is not valid JSON');
    }

    const event = this.provider.parseWebhook(payload);
    if (!event) {
      // An event type we do not act on. Acknowledged, never 4xx'd — Razorpay
      // retries on any non-2xx and eventually disables an endpoint that keeps
      // rejecting, so a 400 here would take down settlement for everything.
      this.logger.debug('ignoring unrecognised webhook event');
      return { received: true };
    }

    // 3. Dedup. Zero rows means we have seen this event id, so return 200
    //    immediately — a duplicate must be cheap, never a 409.
    const inserted = (await this.db.execute(sql`
      insert into webhook_events (provider, event_id, event_type, payload)
      values (${this.provider.name}, ${event.eventId}, ${event.eventType}, ${JSON.stringify(payload)}::jsonb)
      on conflict (provider, event_id) do nothing
      returning id
    `)) as unknown as Array<{ id: string }>;

    if (inserted.length === 0) {
      this.logger.debug(`webhook ${event.eventId} already processed`);
      return { received: true };
    }

    const webhookRowId = inserted[0]!.id;

    try {
      await this.apply(event);
      await this.db.execute(sql`
        update webhook_events set processed_at = now() where id = ${webhookRowId}::uuid
      `);
    } catch (error) {
      // Recorded, still acknowledged: the reconciliation poll re-derives the
      // truth from the provider within five minutes, which is a better outcome
      // than Razorpay retrying a payload we cannot act on.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`webhook ${event.eventId} could not be applied: ${reason}`);
      await this.db.execute(sql`
        update webhook_events set error = ${reason} where id = ${webhookRowId}::uuid
      `);
    }

    return { received: true };
  }

  private async apply(event: NonNullable<ReturnType<PayoutProviderPort['parseWebhook']>>): Promise<void> {
    const payout = await this.payouts.findForWebhook(event.providerRef, event.payoutId);

    if (!payout) {
      // Typically the race where the provider accepted the payout and answered
      // the webhook before our own `markProcessing` committed.
      throw new Error(
        `no payout matches ref=${event.providerRef ?? 'null'} id=${event.payoutId ?? 'null'}`,
      );
    }

    if (event.status === 'paid') {
      await this.payouts.markPaid(payout.id, event.providerRef);
      return;
    }

    if (event.status === 'failed') {
      await this.payouts.markFailed(payout.id, event.failureReason ?? 'Provider reported a failure');
      return;
    }

    // `processing` / `unknown`: nothing to transition. The row is already
    // non-terminal and the poll will follow up.
  }
}
