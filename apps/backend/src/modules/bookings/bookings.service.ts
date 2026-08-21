import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  CUSTOMER_NAMESPACE,
  ErrorCodes,
  paiseToRupeeString,
  rupeeStringToPaise,
  type BookingCancel,
  type BookingCancelResponse,
  type BookingCreate,
  type BookingDetail,
  type BookingOtpResponse,
  type WsTicketResponse,
} from '@towing/api-contracts';
import { eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { KillSwitchService } from '../../common/killswitch/killswitch.service';
import { NotificationService } from '../../common/notifications/notification.service';
import { QUEUE, type QueuePort } from '../../common/queue/queue.port';
import { ENV, type Env } from '../../config/env';
import { DB, type Database } from '../../db/db.module';
import { WsTicketService } from '../../realtime/ws-ticket.service';
import { bookingStatusHistory, bookings, users } from '../../db/schema';
import { PricingService } from '../pricing/pricing.service';
import { BookingOtpService } from './booking-otp.service';
import { BookingStateMachineService } from './booking-state-machine.service';
import { BookingsRepo, isOtpAvailable } from './bookings.repo';
import { cancellationPolicy } from './cancellation-policy';
import { DispatchConfigRepo } from './dispatch-config.repo';

/**
 * §3.4's booking creation, and the customer's read/cancel surface.
 *
 * "Atomic booking + fare lock + commission lock + assignment in a single DB
 * transaction (no double-assignment, no orphan bookings, no rate drift)." The
 * assignment half moved to `modules/dispatch` in Phase 17 — this owns creation,
 * the customer's read surface and cancellation; `OfferService.accept` owns the
 * transaction that commits a driver to the job.
 *
 * The `dispatch.search` worker that used to live here as a no-op is gone with
 * it: `DispatchService` registers the real one.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(QUEUE) private readonly queue: QueuePort,
    private readonly repo: BookingsRepo,
    private readonly pricing: PricingService,
    private readonly otp: BookingOtpService,
    private readonly machine: BookingStateMachineService,
    private readonly config: DispatchConfigRepo,
    private readonly notifications: NotificationService,
    private readonly tickets: WsTicketService,
    private readonly killSwitch: KillSwitchService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(userId: string, body: BookingCreate): Promise<BookingDetail> {
    const guards = await this.config.load();

    // ── §3.7 / §3.8 guards, cheapest first ────────────────────────────────
    const [account] = await this.db
      .select({ status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!account) throw ApiException.unauthorized();
    if (account.status !== 'active') {
      // `customer.policy.ts` already drops a suspended customer's session at the
      // next refresh — but an access token minted a minute before the suspension
      // is still valid, and this is the window it would otherwise book in.
      throw new ApiException(
        403,
        ErrorCodes.ACCOUNT_NOT_ACTIVE,
        'This account cannot create bookings. Please contact support.',
      );
    }

    if (guards.oneActiveBookingPerCustomer) {
      const open = await this.repo.findOpenBooking(userId);
      if (open) {
        throw new ApiException(
          409,
          ErrorCodes.ACTIVE_BOOKING_EXISTS,
          'You already have a trip in progress',
          { bookingId: open.id, status: open.status },
        );
      }
    }

    if (guards.blockOnUnpaidBalance) {
      const unpaid = await this.repo.findUnpaidBooking(userId);
      if (unpaid) {
        throw new ApiException(
          409,
          ErrorCodes.UNPAID_BALANCE,
          'Please settle your previous trip before booking again',
          { bookingId: unpaid.id },
        );
      }
    }

    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
      throw ApiException.validation('A scheduled pickup must be in the future', {
        scheduledAt: 'must be in the future',
      });
    }

    // ── The fare lock (§3.4) ──────────────────────────────────────────────
    const locked = await this.pricing.lock({
      serviceSlug: body.serviceSlug,
      vehicleClass: body.vehicleClass,
      pickup: body.pickup,
      drop: body.drop,
      scheduledAt: body.scheduledAt,
    });

    const minted = this.otp.mintForCreate();

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(bookings)
        .values({
          userId,
          zoneId: locked.zone.id,
          serviceType: locked.service.serviceType,
          vehicleClass: locked.vehicleClass,

          pickupLat: body.pickup.lat,
          pickupLng: body.pickup.lng,
          pickupAddress: body.pickupAddress,
          dropLat: body.drop?.lat ?? null,
          dropLng: body.drop?.lng ?? null,
          dropAddress: body.dropAddress ?? null,
          distanceKm: locked.distanceKm.toFixed(2),

          status: 'searching',

          baseFare: paiseToRupeeString(locked.fare.basePaise),
          nightCharge: paiseToRupeeString(locked.fare.nightPaise),
          highwayCharge: paiseToRupeeString(locked.fare.highwayPaise),
          accidentCharge: paiseToRupeeString(locked.fare.accidentPaise),
          surgeAmount: paiseToRupeeString(locked.fare.surgePaise),
          discount: paiseToRupeeString(locked.fare.discountPaise),
          total: paiseToRupeeString(locked.fare.totalPaise),

          // Locked here and never recomputed. §3.8: "Commission band changed by
          // admin mid-search: irrelevant to the active booking — band + % were
          // locked at confirm."
          commissionBand: locked.fare.band,
          commissionPct: locked.commissionPct.toFixed(2),
          // The AMOUNTS stay at zero until Phase 19 captures payment: §19.2 is
          // explicit that credit happens on capture, never at completion, and a
          // pre-credited commission would show up as ledger drift.
          commissionAmount: '0.00',
          driverPayout: '0.00',

          ...minted,
          scheduledAt,
          note: body.note ?? null,
          contactName: body.contact?.name ?? null,
          contactMobile: body.contact?.mobile ?? null,
        })
        .returning({ id: bookings.id });

      // The §5.1 machine has no edge INTO `searching` from nothing, so creation
      // writes the opening history row directly rather than through
      // `transition()`. Every subsequent move goes through the machine.
      await tx.insert(bookingStatusHistory).values({
        bookingId: row!.id,
        status: 'searching',
        actor: 'customer',
        note: scheduledAt ? `Scheduled for ${scheduledAt.toISOString()}` : null,
      });

      return row!.id;
    });

    // ── After commit, never inside ────────────────────────────────────────
    // `ledger.service.ts` states the rule: enqueueing from inside the
    // transaction lets a worker read the row before it is visible, and a
    // rollback leaves a job for a booking that does not exist.
    await this.announceCreation(created, userId, locked);

    const detail = await this.repo.detail(userId, created);
    if (!detail) throw ApiException.notFound('Booking not found');
    return detail;
  }

  private async announceCreation(
    bookingId: string,
    userId: string,
    locked: Awaited<ReturnType<PricingService['lock']>>,
  ): Promise<void> {
    try {
      await this.notifications.emit('booking.confirmed', {
        bookingId,
        userId,
        reference: `TW-${bookingId.slice(0, 8).toUpperCase()}`,
        serviceName: locked.service.name,
        amount: `₹${paiseToRupeeString(locked.fare.totalPaise)}`,
      });
    } catch (error) {
      this.logger.warn(`booking confirmation notification failed for ${bookingId}: ${String(error)}`);
    }

    try {
      // A scheduled booking waits. `delayMs` is durable in BullMQ, so this
      // survives a task recycling — which an in-process timer would not, and
      // which is the whole reason §6 dispatch is a queue job.
      const [row] = await this.db
        .select({ scheduledAt: bookings.scheduledAt })
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1);

      const delayMs = row?.scheduledAt
        ? Math.max(0, row.scheduledAt.getTime() - Date.now())
        : undefined;

      await this.queue.enqueue('dispatch.search', { bookingId }, { jobId: `dispatch:${bookingId}`, delayMs });
    } catch (error) {
      this.logger.warn(`dispatch enqueue failed for ${bookingId}: ${String(error)}`);
    }
  }

  async get(userId: string, bookingId: string): Promise<BookingDetail> {
    const detail = await this.repo.detail(userId, bookingId);
    if (!detail) throw ApiException.notFound('Booking not found');
    return detail;
  }

  /**
   * §9.1.6's "retry / widen".
   *
   * The wave is RESET to zero and the deadline cleared, unlike §6.5's
   * re-dispatch which resumes where it left off. The distinction is whose
   * failure it was: a driver cancelling mid-job is the platform's problem and
   * the customer should not lose their place in the ladder, whereas a search
   * that found nobody has already exhausted the ladder — starting it again from
   * the widest rung would just repeat the last wave.
   *
   * Exclusions are deliberately NOT cleared. Every driver in `dispatch_attempts`
   * for this booking already declined or ignored it, and asking them again
   * immediately is how a retry produces the same empty result more slowly.
   */
  async retrySearch(userId: string, bookingId: string): Promise<BookingDetail> {
    const detail = await this.repo.detail(userId, bookingId);
    if (!detail) throw ApiException.notFound('Booking not found');

    const result = await this.db.transaction((tx) =>
      this.machine.transition(tx, {
        bookingId,
        to: 'searching',
        actor: 'customer',
        note: 'Customer retried the search',
        patch: { searchWave: null, dispatchDeadlineAt: null },
      }),
    );
    await this.machine.announce(result);

    try {
      // A fresh discriminator, or BullMQ would refuse the job as a duplicate of
      // the search that just gave up.
      await this.queue.enqueue(
        'dispatch.search',
        { bookingId },
        { jobId: `dispatch-${bookingId}-retry-${Date.now()}` },
      );
    } catch (error) {
      this.logger.warn(`retry enqueue failed for ${bookingId}: ${String(error)}`);
    }

    const updated = await this.repo.detail(userId, bookingId);
    if (!updated) throw ApiException.notFound('Booking not found');
    return updated;
  }

  /**
   * The `/customer` handshake ticket (Phase 17).
   *
   * The ownership check is the `repo.detail` read — scoped by `userId` in its
   * WHERE, so a booking belonging to someone else reads as absent. That is what
   * lets `CustomerGateway` join a room with no authorization logic of its own.
   */
  async issueRealtimeTicket(userId: string, bookingId: string): Promise<WsTicketResponse> {
    const detail = await this.repo.detail(userId, bookingId);
    if (!detail) throw ApiException.notFound('Booking not found');

    if (!this.env.REALTIME_ENABLED || (await this.killSwitch.isPollingForced())) {
      // §19.2 and §19.8: a specific code rather than a 500, so TowGo falls
      // straight to its 10-second poll — which carries the same search state —
      // instead of burning a reconnect budget on a socket that will be refused.
      throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE,
        ErrorCodes.REALTIME_UNAVAILABLE,
        'Realtime is unavailable; poll GET /v1/bookings/:id',
      );
    }

    const ticket = await this.tickets.issue({ realm: 'customer', subjectId: userId, bookingId });
    return {
      ticket,
      expiresInSeconds: this.tickets.ttlSeconds,
      wsUrl: this.env.PUBLIC_WS_URL,
      namespace: CUSTOMER_NAMESPACE,
    };
  }

  list(userId: string, limit: number, cursor?: string) {
    return this.repo.list(userId, limit, cursor);
  }

  /**
   * §9.1.7's OTP card. Never before assignment; rotates if the window lapsed.
   */
  async issueOtp(userId: string, bookingId: string): Promise<BookingOtpResponse> {
    const detail = await this.repo.detail(userId, bookingId);
    if (!detail) throw ApiException.notFound('Booking not found');

    if (!isOtpAvailable(detail.status)) {
      throw new ApiException(
        409,
        ErrorCodes.OTP_NOT_AVAILABLE,
        'Your booking OTP appears once a driver is assigned',
        { status: detail.status },
      );
    }

    const issued = await this.otp.issue(this.db, bookingId);
    return { code: issued.code, expiresAt: issued.expiresAt.toISOString() };
  }

  /**
   * §3.5 cancellation — the FREE branches only.
   *
   * The chargeable tiers are computed and reported, then refused: taking a fee
   * needs a ledger entry and a driver-compensation leg, which is Phase 19. A
   * 409 that names the fee is honest; silently cancelling for ₹0 would be a
   * revenue bug nobody notices until the first month's numbers.
   */
  async cancel(userId: string, bookingId: string, body: BookingCancel): Promise<BookingCancelResponse> {
    const [row] = await this.db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        status: bookings.status,
        createdAt: bookings.createdAt,
        baseFare: bookings.baseFare,
      })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!row || row.userId !== userId) throw ApiException.notFound('Booking not found');

    const outcome = cancellationPolicy({
      status: row.status,
      confirmedAt: row.createdAt,
      basePaise: rupeeStringToPaise(row.baseFare),
    });

    if (outcome.tier !== 'free') {
      throw new ApiException(
        409,
        ErrorCodes.CANCELLATION_NOT_FREE,
        `${outcome.reason} — cancellation fees are not collectable yet`,
        { tier: outcome.tier, feePaise: outcome.feePaise },
      );
    }

    const result = await this.db.transaction((tx) =>
      this.machine.transition(tx, {
        bookingId,
        to: 'cancelled',
        actor: 'customer',
        note: body.reason ?? null,
        patch: {
          cancelledBy: 'customer',
          cancellationReason: body.reason ?? null,
          cancellationFee: '0.00',
        },
      }),
    );

    await this.machine.announce(result);
    await this.otp.forget(bookingId);

    return { id: bookingId, status: 'cancelled', tier: outcome.tier, feePaise: outcome.feePaise };
  }
}
