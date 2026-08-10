import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { payoutAccountStatusEnum, walletOwnerTypeEnum } from './enums';

/**
 * The payout destination — a Razorpay Route linked account plus the bank
 * details behind it (§9.3.1 "bank details for payouts (Route)", §14.4).
 *
 * **A table keyed `(owner_type, owner_id)`, not columns on `fleets`**, for
 * three reasons:
 *
 *  1. Track B Phase 19 needs the identical thing for drivers. Keying it the way
 *     `wallets` and `payouts` are keyed makes that a zero-migration change;
 *     columns on `fleets` would force a parallel column set on `drivers` and a
 *     second adapter code path.
 *  2. It is a state machine (`unlinked → pending → active → rejected|suspended`)
 *     with vendor ids, a failure reason and a linked-at timestamp — not nine
 *     more attributes bolted onto the tenant row that every guard and every
 *     settings read already touches.
 *  3. It is the only table holding financial-destination data, so a future
 *     column-level grant, redaction policy or KMS envelope stays a one-table
 *     concern and `SELECT * FROM fleets` never carries bank data by accident.
 *
 * **The full account number is never persisted.** It goes to the provider at
 * onboarding and is dropped; `account_number_last4` is for display and
 * `account_number_fingerprint` (sha256 of `number|ifsc`) answers "did they
 * change the account?" without being reversible. There is no KMS before Phase
 * 9a, and a reserved `account_number_enc` column would only invite someone to
 * fill it with plaintext. If Route ever needs re-submission, the fleet re-enters it.
 */
export const payoutAccounts = pgTable(
  'payout_accounts',
  {
    id: primaryId(),
    /** No FK — polymorphic across fleets and (Phase 19) drivers, like `wallets`. */
    ownerId: uuid('owner_id').notNull(),
    ownerType: walletOwnerTypeEnum('owner_type').notNull(),
    status: payoutAccountStatusEnum('status').notNull().default('unlinked'),
    /** Razorpay Route account id (`acc_…`). */
    routeAccountId: text('route_account_id'),
    /** Razorpay fund account id (`fa_…`) — what a payout actually pays into. */
    routeFundAccountId: text('route_fund_account_id'),
    beneficiaryName: text('beneficiary_name'),
    accountNumberLast4: text('account_number_last4'),
    accountNumberFingerprint: text('account_number_fingerprint'),
    ifsc: text('ifsc'),
    bankName: text('bank_name'),
    /** Populated on `rejected`/`suspended`; surfaced verbatim in the console. */
    failureReason: text('failure_reason'),
    linkedAt: timestamp('linked_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique('uq_payout_accounts_owner').on(t.ownerType, t.ownerId),
    index('idx_payout_accounts_status').on(t.status),
  ],
);
