import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { money, primaryId, timestamps } from './columns';
import {
  paymentMethodEnum,
  paymentStatusEnum,
  payoutStatusEnum,
  refundStatusEnum,
  walletOwnerTypeEnum,
  walletTxnTypeEnum,
} from './enums';
import { bookings } from './bookings';

/**
 * Money is ledger-first (§3.4): `wallets.balance` is a cached projection and
 * `wallet_transactions` is the source of truth. Every balance must be
 * reconstructible by summing its entries — that is what the ledger invariant
 * test asserts.
 */
export const wallets = pgTable(
  'wallets',
  {
    id: primaryId(),
    ownerId: uuid('owner_id').notNull(),
    ownerType: walletOwnerTypeEnum('owner_type').notNull(),
    balance: money('balance').notNull().default('0'),
    ...timestamps,
  },
  (t) => [unique('uq_wallets_owner').on(t.ownerType, t.ownerId)],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: primaryId(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    type: walletTxnTypeEnum('type').notNull(),
    // Signed: credits positive, debits negative, so SUM(amount) == balance.
    amount: money('amount').notNull(),
    reason: text('reason'),
    refId: uuid('ref_id'),
    /**
     * NOT NULL since migration 0006. Postgres unique indexes treat NULLs as
     * distinct, so a keyless leg was silently exempt from the dedup that §14.1
     * ("all money mutations carry an idempotency key") requires. Every writer
     * already set it; making it a database fact closes the hole.
     */
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // §17 requires this unique key — it is what makes a retried credit a no-op.
    unique('uq_wallet_transactions_idempotency_key').on(t.idempotencyKey),
    index('idx_wallet_transactions_wallet').on(t.walletId, t.createdAt),
    index('idx_wallet_transactions_ref').on(t.refId),
  ],
);

export const payments = pgTable(
  'payments',
  {
    id: primaryId(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    gatewayRef: text('gateway_ref'),
    amount: money('amount').notNull(),
    method: paymentMethodEnum('method').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    idempotencyKey: text('idempotency_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_payments_idempotency_key').on(t.idempotencyKey),
    index('idx_payments_booking').on(t.bookingId),
  ],
);

/**
 * §5.5 `payout_requested → processing (Route) → paid | failed`.
 *
 * There is deliberately **no `fleet_id`**: `owner_id` IS the fleet id when
 * `owner_type = 'fleet'` (the same polymorphic shape as `wallets` and
 * `payout_accounts`), a `fleet_id` column would be NULL for every Phase 19
 * driver row and need a CHECK to stay consistent with `owner_id`, and
 * `idx_payouts_owner` already serves the tenant-scoped history.
 *
 * The money is debited from the wallet at REQUEST time, not at `paid` — see
 * `PayoutsService`. In a signed append-only ledger a hold *is* a debit; a
 * failure writes a compensating `adjustment` credit rather than removing it,
 * per §14.5's "compensating ledger entries (never edits)".
 */
export const payouts = pgTable(
  'payouts',
  {
    id: primaryId(),
    ownerId: uuid('owner_id').notNull(),
    ownerType: walletOwnerTypeEnum('owner_type').notNull(),
    amount: money('amount').notNull(),
    /** Provider payout reference (Razorpay `pout_…`) once accepted. */
    routeRef: text('route_ref'),
    status: payoutStatusEnum('status').notNull().default('requested'),
    idempotencyKey: text('idempotency_key'),
    /** Populated on `failed`; rendered verbatim in the row and the alert. */
    failureReason: text('failure_reason'),
    /** Which adapter created it — `dev` rows must be obvious in a prod dump. */
    provider: text('provider'),
    /** Last time the reconciliation poll asked the provider for the truth. */
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('uq_payouts_idempotency_key').on(t.idempotencyKey),
    index('idx_payouts_owner').on(t.ownerType, t.ownerId, t.requestedAt),
  ],
);

/**
 * §14.5. No `idempotency_key` column, unlike every other money table — that
 * matches §17's schema exactly, and no refund writer exists yet (the customer
 * app and the admin console own that path in Track B). Adding a nullable column
 * plus a unique index now would mean inventing a key grammar for a writer that
 * does not exist, then altering it later. Whichever phase ships refunds adds it.
 */
export const refunds = pgTable(
  'refunds',
  {
    id: primaryId(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    amount: money('amount').notNull(),
    reason: text('reason'),
    gatewayRef: text('gateway_ref'),
    status: refundStatusEnum('status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_refunds_booking').on(t.bookingId)],
);
