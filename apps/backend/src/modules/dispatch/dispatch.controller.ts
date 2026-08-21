import { Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import {
  jobRejectSchema,
  type CurrentJobResponse,
  type CurrentOfferResponse,
  type JobAcceptResponse,
  type JobReject,
} from '@towing/api-contracts';
import { z } from 'zod';
import { ThrottleBucket } from '../../common/throttling/throttler.config';
import { ZodBody, ZodParam } from '../../common/validation/zod.decorators';
import type { AuthedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KycApprovedGuard } from '../auth/kyc-approved.guard';
import { Realms } from '../auth/realm.decorator';
import { driverId } from '../driver-kyc/driver-kyc.controller';
import { OfferService } from './offer.service';

/**
 * The driver's dispatch surface (§6.3, §16.3) — thin routes over
 * `OfferService`, where every semantic lives.
 *
 * `KycApprovedGuard` on the whole controller, matching `DriverPresenceController`:
 * a driver suspended between being offered a job and tapping Accept is refused
 * here before the transaction is even opened. The transaction re-checks anyway
 * (§3.1's database layer), because the guard's read and the commit are not the
 * same instant — but failing fast at the edge keeps the common case cheap.
 */
@Controller()
@UseGuards(JwtAuthGuard, KycApprovedGuard)
@Realms('driver')
export class DispatchController {
  constructor(private readonly offers: OfferService) {}

  /**
   * §19.2's offer resync.
   *
   * A socket frame is not a durable delivery: a driver whose connection dropped
   * inside the twenty-second window would otherwise never see the offer, and
   * the push may have been suppressed by the OS. The app calls this on
   * foreground and on reconnect.
   */
  @Get('driver/offers/current')
  @ThrottleBucket('realtime')
  async currentOffer(@Req() request: AuthedRequest): Promise<CurrentOfferResponse> {
    return { offer: await this.offers.currentOffer(driverId(request)) };
  }

  /** The job the driver is committed to, or `null` when idle. */
  @Get('driver/jobs/current')
  @ThrottleBucket('realtime')
  async currentJob(@Req() request: AuthedRequest): Promise<CurrentJobResponse> {
    return { job: await this.offers.currentJob(driverId(request)) };
  }

  /**
   * §6.3's accept — the transaction that commits a driver to a fare-locked
   * booking.
   *
   * IDEMPOTENT WITHOUT AN `Idempotency-Key`, and deliberately so. §19.4 requires
   * the header on mutating booking and money endpoints, and this is arguably
   * both — but the mechanism it provides is weaker here than what the offer
   * already has. A double-tapped accept finds its `dispatch_attempts` row no
   * longer `offered` and takes the same graceful 409 a losing racer does, which
   * is the correct answer to "did my first tap work?" whether the second tap was
   * an accident or a retry. An idempotency key would replay a cached 200 for the
   * SAME key, and change nothing for a genuine double-tap, which sends two.
   *
   * `money` bucket: this assigns a driver to a locked fare and moves the
   * economics of the trip. Same reasoning as the KYC decision route.
   */
  @Post('jobs/:id/accept')
  @ThrottleBucket('money')
  @HttpCode(HttpStatus.OK)
  async accept(
    @ZodParam(z.uuid(), 'id') bookingId: string,
    @Req() request: AuthedRequest,
  ): Promise<JobAcceptResponse> {
    return { job: await this.offers.accept(bookingId, driverId(request)) };
  }

  /**
   * §6.3's decline. 204, because there is nothing to say back.
   *
   * Never an error, even for an offer that already expired — the driver's intent
   * is satisfied either way, and a 409 on "I don't want this job" would be a
   * confusing thing to show someone who is about to be offered another one.
   */
  @Post('jobs/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reject(
    @ZodParam(z.uuid(), 'id') bookingId: string,
    @ZodBody(jobRejectSchema) body: JobReject,
    @Req() request: AuthedRequest,
  ): Promise<void> {
    await this.offers.reject(bookingId, driverId(request), body.reason);
  }
}
