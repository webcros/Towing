/**
 * The payout vendor seam (§14.4 Razorpay Route).
 *
 * Same shape as every other port in the codebase: a `Symbol` token, an
 * interface here, adapters beside it, and one binding in the module. The
 * consequence that matters is the same one `StoragePort` and `NotificationPort`
 * deliver — swapping providers, or running with none at all, is a provider
 * binding, not a rewrite.
 *
 * **Track B Phase 19 pays drivers through this same port.** `ownerType` is
 * therefore a parameter everywhere rather than an assumption, exactly as
 * `wallets` and `payout_accounts` are keyed.
 */

export const PAYOUT_PROVIDER = Symbol('PAYOUT_PROVIDER');

export type PayoutOwnerType = 'fleet' | 'driver';

export interface LinkAccountParams {
  ownerType: PayoutOwnerType;
  ownerId: string;
  /** Registered business/legal name — Route validates it against the PAN. */
  legalName: string;
  beneficiaryName: string;
  /** Full account number. Passed to the vendor and NEVER persisted by us. */
  accountNumber: string;
  ifsc: string;
  email: string;
  phone: string;
  gstin?: string | null;
  address?: string | null;
}

export interface LinkedAccount {
  /** Route linked-account id (`acc_…`). */
  accountId: string;
  /** Route fund-account id (`fa_…`) — what a payout actually pays into. */
  fundAccountId: string;
  /** `pending` while the vendor is still verifying the beneficiary. */
  status: 'pending' | 'active' | 'rejected';
  bankName?: string | null;
  failureReason?: string | null;
}

export interface CreatePayoutParams {
  /** Our payout row id. Echoed back in `notes` so a webhook can find us. */
  payoutId: string;
  ownerType: PayoutOwnerType;
  ownerId: string;
  amountPaise: number;
  /** `payout_accounts.route_fund_account_id`. */
  destinationRef: string;
  /** Sent on the vendor's own idempotency header. */
  idempotencyKey: string;
}

export interface PayoutHandle {
  /** The vendor's payout reference (`pout_…`). */
  providerRef: string;
  status: 'processing' | 'paid' | 'failed';
  failureReason?: string | null;
}

export interface PayoutWebhookEvent {
  /** The vendor's event id — the dedup key stored on `webhook_events`. */
  eventId: string;
  eventType: string;
  providerRef: string | null;
  /** Our payout id from `notes`, when the vendor echoed it back. */
  payoutId: string | null;
  status: 'processing' | 'paid' | 'failed' | 'unknown';
  failureReason?: string | null;
}

export interface PayoutProviderPort {
  /** `'dev' | 'razorpay_route'` — recorded on `payouts.provider`. */
  readonly name: string;

  /** §9.3.1's "bank details for payouts (Route)". Called outside any transaction. */
  linkAccount(params: LinkAccountParams): Promise<LinkedAccount>;

  createPayout(params: CreatePayoutParams): Promise<PayoutHandle>;

  /**
   * The authoritative status of one payout, for the §19.3 reconciliation poll
   * that covers a webhook we never received.
   */
  fetchPayout(providerRef: string): Promise<PayoutHandle>;

  /**
   * Pure, no I/O, constant-time. Takes the RAW request body — a re-serialised
   * JSON object will not hash to the same bytes, which is the single most
   * common way webhook verification is silently broken.
   */
  verifyWebhook(rawBody: Buffer, signature: string): boolean;

  /** Null for an event type we do not act on (still acknowledged with 200). */
  parseWebhook(payload: unknown): PayoutWebhookEvent | null;
}
