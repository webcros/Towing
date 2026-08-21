import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { DriverPresenceModule } from '../driver-presence/driver-presence.module';
import { PricingModule } from '../pricing/pricing.module';
import { CandidateSelectionService } from './candidate-selection.service';
import { DispatchController } from './dispatch.controller';

import { DispatchRepo } from './dispatch.repo';
import { DispatchService } from './dispatch.service';
import { OfferService } from './offer.service';

/**
 * §6's dispatch engine (Phase 17).
 *
 * WHAT IT IMPORTS IS THE §3.2 JOIN POINT, and it is worth reading the list as a
 * statement about why this phase could not have come earlier:
 *
 * - `DriverPresenceModule` (16) — the candidate store, the liveness rule, and
 *   the offer lock that sits beside the presence keys.
 * - `BookingsModule` (15) — `BookingStateMachineService`, which is the only
 *   thing allowed to write `bookings.status`, and `CustomerGateway`, which is
 *   where §9.1.6's wave progress goes. Also `DispatchConfigRepo`, the §6.2
 *   scorer weights.
 * - `PricingModule` (14) — the zone resolver, and `haversineMeters` for the
 *   proximity term.
 * - `AuthModule` (10/11) — `JwtAuthGuard` and `KycApprovedGuard`.
 *
 * Every one of those had to be functioning before a candidate could be filtered.
 * Notifications, the queue, Redis and the DB are `@Global()`.
 *
 * Exports `DispatchService` for Phase 18's §6.5 re-dispatch (a driver who
 * cancels an assigned job puts the booking back into the search). The kill
 * switches live in `common/killswitch` and are `@Global()` — all three ticket
 * routes read them, and none of those should import a dispatch module.
 */
@Module({
  imports: [AuthModule, DriverPresenceModule, BookingsModule, PricingModule],
  controllers: [DispatchController],
  providers: [
    DispatchService,
    CandidateSelectionService,
    OfferService,
    DispatchRepo,
  ],
})
export class DispatchModule {}
