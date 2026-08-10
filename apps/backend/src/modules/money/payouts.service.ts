import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCodes,
  paiseToRupeeString,
  rupeeStringToPaise,
  type FleetId,
  type PayoutDto,
  type PayoutsListResponse,
  type PayoutsQuery,
} from '@towing/api-contracts';
import { ApiException } from '../../common/errors/api-exception';
import { isUniqueViolation } from '../../common/errors/pg-errors';
import { FleetEventsService } from '../../common/events/fleet-events.service';
import { NOTIFICATIONS, type NotificationPort } from '../../common/notifications/notification.port';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db.module';
import { ledgerKeys } from '../../db/ledger/idempotency-keys';
import { LedgerService } from '../../db/ledger/ledger.service';
import { EarningsRepo } from './earnings.repo';
import { openPayoutFailedAlert, resolvePayoutAlert } from './payout-alerts';
import { PAYOUT_PROVIDER, type PayoutProviderPort } from './payout-provider.port';
import { PayoutsRepo, type PayoutRow } from './payouts.repo';

/**
 * §14.4 payouts.
 *
 * **The wallet is debited at REQUEST time, not at `paid`.** In a signed
 * append-only ledger a hold IS a debit — §14.5's rule for the whole system is
 * "compensating ledger entries (never edits)", so a two-phase hold that later
 * got *removed* would be exactly the edit the spec forbids. And if a
 * `requested` payout carried no debit, the balance would still show the money
 * as available and a fleet could request ₹10,000 twice. The check and the debit
 * happen inside one `SELECT … FOR UPDATE` in `LedgerService.post`.
 *
 * A failure does not undo the debit; it writes an `adjustment` credit that
 * returns the funds, leaving both facts in the history.
 */
@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private readonly repo: PayoutsRepo,
    private readonly earnings: EarningsRepo,
    private readonly ledger: LedgerService,
    private readonly events: FleetEventsService,
    @Inject(DB) private readonly db: Database,
    @Inject(PAYOUT_PROVIDER) private readonly provider: PayoutProviderPort,
    @Inject(NOTIFICATIONS) private readonly notifications: NotificationPort,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async request(fleetId: FleetId, amountPaise: number, clientKey: string): Promise<PayoutDto> {
    // ── Preflight: cheap, specific failures before anything is written ──────
    if (amountPaise < this.env.PAYOUT_MIN_PAISE) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCodes.PAYOUT_BELOW_MINIMUM,
        `The minimum payout is ₹${(this.env.PAYOUT_MIN_PAISE / 100).toLocaleString('en-IN')}`,
        { minPaise: this.env.PAYOUT_MIN_PAISE },
      );
    }

    if (amountPaise > this.env.PAYOUT_MAX_PAISE) {
      throw new ApiException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        ErrorCodes.PAYOUT_ABOVE_MAXIMUM,
        `The maximum payout is ₹${(this.env.PAYOUT_MAX_PAISE / 100).toLocaleString('en-IN')}`,
        { maxPaise: this.env.PAYOUT_MAX_PAISE },
      );
    }

    const destination = await this.destination(fleetId);

    // Namespaced by fleet: `uq_payouts_idempotency_key` is GLOBAL, so two
    // fleets both sending `Idempotency-Key: 1` would otherwise collide and the
    // second would silently receive the first one's payout.
    const storedKey = `po:v1:req:${fleetId}:${sha256(clientKey)}`;

    const payout = await this.createWithHold(fleetId, amountPaise, storedKey);

    // Replay: the row already existed, so the money already moved. Return it
    // rather than calling the provider a second time.
    if (payout.replayed) return toDto(payout.row);

    // ── The vendor call happens AFTER COMMIT, never inside the transaction ──
    // A network call inside a transaction holds the wallet row lock for the
    // duration, which turns a slow provider into a database incident.
    return this.submit(payout.row, destination, storedKey);
  }

  /** The webhook's lookup: provider reference first, our echoed id as fallback. */
  findForWebhook(providerRef: string | null, payoutId: string | null): Promise<PayoutRow | null> {
    return this.repo.byProviderRefOrId(providerRef, payoutId);
  }

  async list(fleetId: FleetId, query: PayoutsQuery): Promise<PayoutsListResponse> {
    const { items, total } = await this.repo.page(fleetId, query);
    return { items: items.map(toDto), page: query.page, limit: query.limit, total };
  }

  /**
   * `requested|processing → paid`. **No ledger write** — the debit happened at
   * request time. Called by the webhook and by the reconciliation poll.
   */
  async markPaid(payoutId: string, providerRef?: string | null): Promise<void> {
    const row = await this.repo.transitionToTerminal(payoutId, 'paid', {
      providerRef: providerRef ?? null,
      failureReason: null,
    });

    // Already terminal. Doing anything here would let a late `processed` event
    // resurrect a failed payout.
    if (!row) return;

    await resolvePayoutAlert(this.db, payoutId);
    await this.notify(row, 'payout_paid');
    await this.events.emit(row.ownerId, { kind: 'payout_status', payoutId, status: 'paid' });

    this.logger.log(`payout ${payoutId} paid (${row.routeRef ?? 'no provider ref'})`);
  }

  /**
   * `requested|processing → failed`, plus the compensating credit and the
   * alert. One function, three callers — the provider error at request time,
   * the webhook, and the reconciliation poll — so there is one failure path
   * rather than three that drift.
   */
  async markFailed(payoutId: string, reason: string): Promise<void> {
    const row = await this.repo.transitionToTerminal(payoutId, 'failed', { failureReason: reason });
    if (!row) return;

    // §14.5: compensating entry, never an edit. `adjustment` and not
    // `refund_credit` — `refund_*` is the customer-refund lifecycle over the
    // `refunds` table; a returned payout is not a refund.
    await this.ledger.post([
      {
        owner: { ownerType: row.ownerType, ownerId: row.ownerId },
        type: 'adjustment',
        amountPaise: rupeeStringToPaise(row.amount),
        reason: 'Payout failed — funds returned',
        refId: payoutId,
        idempotencyKey: ledgerKeys.payoutReversal(payoutId),
      },
    ]);

    // Opened HERE, at the point of failure. Phase 6's hourly `syncPayoutAlerts`
    // was an explicit stopgap for the window where no payout write path existed.
    await openPayoutFailedAlert(this.db, payoutId);
    await this.notify(row, 'payout_failed');
    await this.events.emit(row.ownerId, { kind: 'payout_status', payoutId, status: 'failed' });

    this.logger.warn(`payout ${payoutId} failed: ${reason}`);
  }

  /** Insert the row and take the hold in one transaction. */
  private async createWithHold(
    fleetId: FleetId,
    amountPaise: number,
    storedKey: string,
  ): Promise<{ row: PayoutRow; replayed: boolean }> {
    let row: PayoutRow;

    try {
      row = await this.repo.create({
        fleetId,
        amount: paiseToRupeeString(amountPaise),
        idempotencyKey: storedKey,
        provider: this.provider.name,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Which unique index fired decides what this means, so they are told
      // apart by name rather than by guessing from the status code.
      const message = String((error as { cause?: { constraint_name?: string } }).cause?.constraint_name ?? error);

      if (message.includes('uq_payouts_one_open_per_owner')) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          ErrorCodes.PAYOUT_ALREADY_PENDING,
          'A payout is already in progress. Wait for it to settle before requesting another.',
        );
      }

      // The idempotency key. §19.4's "unique constraints as the final backstop"
      // — this is the path that still works with Redis down and the
      // interceptor bypassed entirely.
      const existing = await this.repo.byIdempotencyKey(storedKey);
      if (existing) return { row: existing, replayed: true };

      throw error;
    }

    try {
      await this.ledger.post(
        [
          {
            owner: { ownerType: 'fleet', ownerId: fleetId },
            type: 'payout_debit',
            amountPaise: -amountPaise,
            reason: 'Payout to bank (Razorpay Route)',
            refId: row.id,
            idempotencyKey: ledgerKeys.payoutDebit(row.id),
          },
        ],
        {
          // Read-check-write inside the wallet's row lock. Without it two
          // concurrent requests both read ₹10,000, both pass, both debit, and
          // the balance goes negative — textbook TOCTOU on real money.
          precondition: (balances) => {
            const available = balances.get(`fleet:${fleetId}`) ?? 0;
            if (available < amountPaise) {
              throw new ApiException(
                HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorCodes.INSUFFICIENT_BALANCE,
                'Your wallet balance is lower than the requested payout',
                { availablePaise: available, requestedPaise: amountPaise },
              );
            }
          },
        },
      );
    } catch (error) {
      // The hold failed, so the payout must not survive as an open row — it
      // would occupy `uq_payouts_one_open_per_owner` and block every future
      // request from this fleet.
      await this.repo.transitionToTerminal(row.id, 'failed', {
        failureReason: error instanceof ApiException ? error.message : 'Could not reserve funds',
      });
      throw error;
    }

    return { row, replayed: false };
  }

  /** The provider call and everything that hangs off its three outcomes. */
  private async submit(row: PayoutRow, destinationRef: string, storedKey: string): Promise<PayoutDto> {
    try {
      const handle = await this.provider.createPayout({
        payoutId: row.id,
        ownerType: 'fleet',
        ownerId: row.ownerId,
        amountPaise: rupeeStringToPaise(row.amount),
        destinationRef,
        idempotencyKey: storedKey,
      });

      if (handle.status === 'failed') {
        await this.markFailed(row.id, handle.failureReason ?? 'Provider rejected the payout');
        return toDto((await this.repo.byId(row.id))!);
      }

      await this.repo.markProcessing(row.id, handle.providerRef);
      await this.events.emit(row.ownerId, {
        kind: 'payout_status',
        payoutId: row.id,
        status: 'processing',
      });

      return toDto((await this.repo.byId(row.id))!);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      // **A timeout is not a failure.** This is the case people get wrong: the
      // provider may well have accepted the payout and only the response was
      // lost, so failing it here would return money to a wallet the bank is
      // about to debit. Leave it `requested`; the 5-minute reconciliation poll
      // asks the provider what actually happened, and `PAYOUT_STUCK_MINUTES`
      // fails it only once it is clear nothing was accepted.
      if (isTimeout(error)) {
        this.logger.warn(
          `payout ${row.id} provider call timed out; left as requested for reconciliation: ${reason}`,
        );
        return toDto(row);
      }

      // An explicit, non-timeout provider error takes the same path a webhook
      // failure takes. One failure path, not two.
      await this.markFailed(row.id, reason);
      return toDto((await this.repo.byId(row.id))!);
    }
  }

  private async destination(fleetId: FleetId): Promise<string> {
    const destination = await this.repo.activeDestination(fleetId);

    if (!destination) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        ErrorCodes.PAYOUT_ACCOUNT_NOT_LINKED,
        'Link a bank account before requesting a payout',
      );
    }

    return destination;
  }

  /** §12.2: payout processed/failed notifies push + SMS + email. Best-effort. */
  private async notify(row: PayoutRow, template: 'payout_paid' | 'payout_failed'): Promise<void> {
    for (const channel of ['push', 'sms', 'email'] as const) {
      try {
        await this.notifications.notify({
          to: row.ownerId,
          channel,
          template,
          variables: {
            amount: row.amount,
            payoutId: row.id,
            ...(row.failureReason ? { reason: row.failureReason } : {}),
          },
        });
      } catch (error) {
        // A provider outage must never roll back a completed money transition.
        this.logger.warn(`payout ${template} notification (${channel}) failed: ${String(error)}`);
      }
    }
  }
}

function toDto(row: PayoutRow): PayoutDto {
  return {
    id: row.id,
    amountPaise: rupeeStringToPaise(row.amount),
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
    providerRef: row.routeRef,
    failureReason: row.failureReason,
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** `AbortSignal.timeout` rejects with a `TimeoutError` DOMException. */
function isTimeout(error: unknown): boolean {
  if (error instanceof ApiException) return false;
  const name = (error as { name?: unknown })?.name;
  return name === 'TimeoutError' || name === 'AbortError';
}
