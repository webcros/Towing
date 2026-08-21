import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { ExternalCallPolicy } from '../../common/http/external-call.policy';
import { parseRazorpayPayoutWebhook } from './dev-payout.adapter';
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
 * Razorpay Route (§14.4). Bound when `PAYOUT_PROVIDER=razorpay_route`.
 *
 * Real credentials are a business task (the merchant account plus Route
 * onboarding), so this ships complete and unexercised against the live API —
 * which is exactly why the signature verification, the webhook parsing and the
 * payload shapes are shared with `DevPayoutAdapter` rather than written twice.
 * The half that can be tested locally is tested locally.
 */
@Injectable()
export class RazorpayRouteAdapter implements PayoutProviderPort, OnModuleInit {
  readonly name = 'razorpay_route';

  private readonly logger = new Logger(RazorpayRouteAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly policy: ExternalCallPolicy,
  ) {}

  /**
   * ⚠ Credentials are validated HERE, not in the constructor. Nest instantiates
   * every provider in the module regardless of which one the factory selects,
   * so a constructor that threw on missing Razorpay keys would break the dev
   * path for everyone who has never heard of Razorpay.
   */
  onModuleInit(): void {
    if (this.env.PAYOUT_PROVIDER !== 'razorpay_route') return;

    if (!this.env.RAZORPAY_KEY_ID || !this.env.RAZORPAY_KEY_SECRET) {
      throw new Error(
        'PAYOUT_PROVIDER=razorpay_route requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET',
      );
    }

    this.logger.log(`Razorpay Route adapter active against ${this.env.RAZORPAY_BASE_URL}`);
  }

  async linkAccount(params: LinkAccountParams): Promise<LinkedAccount> {
    // Route onboarding is two calls: a contact, then a fund account bound to it.
    const contact = await this.call<{ id: string }>('POST', '/v1/contacts', {
      name: params.beneficiaryName,
      email: params.email,
      contact: params.phone,
      type: params.ownerType === 'fleet' ? 'vendor' : 'employee',
      reference_id: `${params.ownerType}:${params.ownerId}`,
      notes: {
        legalName: params.legalName,
        ...(params.gstin ? { gstin: params.gstin } : {}),
      },
    });

    const fundAccount = await this.call<{ id: string; active: boolean }>(
      'POST',
      '/v1/fund_accounts',
      {
        contact_id: contact.id,
        account_type: 'bank_account',
        bank_account: {
          name: params.beneficiaryName,
          ifsc: params.ifsc,
          account_number: params.accountNumber,
        },
      },
    );

    return {
      accountId: contact.id,
      fundAccountId: fundAccount.id,
      status: fundAccount.active ? 'active' : 'pending',
    };
  }

  async createPayout(params: CreatePayoutParams): Promise<PayoutHandle> {
    const payout = await this.call<{ id: string; status: string; failure_reason?: string }>(
      'POST',
      '/v1/payouts',
      {
        fund_account_id: params.destinationRef,
        amount: params.amountPaise,
        currency: 'INR',
        mode: 'IMPS',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: params.payoutId,
        // Echoed back on every webhook, so an event can find our row even if we
        // crashed between the vendor accepting and us persisting `route_ref`.
        notes: { payoutId: params.payoutId },
      },
      params.idempotencyKey,
    );

    return {
      providerRef: payout.id,
      status: mapPayoutStatus(payout.status),
      failureReason: payout.failure_reason ?? null,
    };
  }

  async fetchPayout(providerRef: string): Promise<PayoutHandle> {
    const payout = await this.call<{ id: string; status: string; failure_reason?: string }>(
      'GET',
      `/v1/payouts/${providerRef}`,
    );

    return {
      providerRef: payout.id,
      status: mapPayoutStatus(payout.status),
      failureReason: payout.failure_reason ?? null,
    };
  }

  verifyWebhook(rawBody: Buffer, signature: string): boolean {
    return verifyWebhookSignature(rawBody, signature, this.env.PAYOUT_WEBHOOK_SECRET);
  }

  parseWebhook(payload: unknown): PayoutWebhookEvent | null {
    return parseRazorpayPayoutWebhook(payload);
  }

  /**
   * One HTTP helper, through §19.3's `ExternalCallPolicy` since Phase 14.
   *
   * It used to call `fetch` with a bare `AbortSignal.timeout`. Phase 13 built
   * the policy and deliberately did NOT migrate this adapter, leaving a note
   * that it belonged with Phase 14 "where the second consumer actually
   * appears". Two things change by moving:
   *
   *  - a CIRCUIT BREAKER and per-vendor metrics, which `AbortSignal.timeout`
   *    cannot provide. §19.2's "Razorpay down → bookings complete as
   *    COMPLETED (unpaid)" needs something that NOTICES, and that something is
   *    the breaker;
   *  - the timeout becomes a RACE rather than an abort. Phase 13 found that a
   *    callee ignoring the signal — or a `fetch` already reading a body —
   *    resolves normally long after the deadline, parking the caller for
   *    exactly as long as the timeout was meant to prevent.
   *
   * `attempts: 1` KEEPS THE ORIGINAL, CORRECT DECISION. Retries stay out of
   * here — the callers (the payout request path, the reconciliation poll)
   * already know the difference between "failed" and "unknown", and a blind
   * retry inside the adapter would DOUBLE-SEND A PAYOUT. The policy gives us
   * the breaker without the retry ladder; that pairing is why its `attempts`
   * defaults to 1.
   */
  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const auth = Buffer.from(
      `${this.env.RAZORPAY_KEY_ID}:${this.env.RAZORPAY_KEY_SECRET}`,
    ).toString('base64');

    return this.policy.run<T>(
      { vendor: this.name, attempts: 1, timeoutMs: this.env.RAZORPAY_TIMEOUT_MS },
      async (signal) => {
        const response = await fetch(`${this.env.RAZORPAY_BASE_URL}${path}`, {
          method,
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
            ...(idempotencyKey ? { 'X-Payout-Idempotency': idempotencyKey } : {}),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal,
        });

        const text = await response.text();

        if (!response.ok) {
          // The message is logged and stored on `payouts.failure_reason`, so it
          // must not carry the request body — that would put an account number
          // in a log.
          throw new Error(
            `Razorpay ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
          );
        }

        return JSON.parse(text) as T;
      },
    );
  }
}

function mapPayoutStatus(raw: string): PayoutHandle['status'] {
  switch (raw) {
    case 'processed':
      return 'paid';
    case 'reversed':
    case 'failed':
    case 'cancelled':
      return 'failed';
    default:
      // `queued`, `pending`, `initiated`, `processing` — and anything new the
      // vendor introduces. Treating an unknown status as still-in-flight is the
      // safe direction: the poll will ask again.
      return 'processing';
  }
}
