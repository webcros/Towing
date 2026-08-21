import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DriverPresenceModule } from '../driver-presence/driver-presence.module';
import { PricingModule } from '../pricing/pricing.module';
import { DriversNearbyController } from './drivers-nearby.controller';
import { DriversNearbyService } from './drivers-nearby.service';

/**
 * The customer-facing read over Phase 16's candidate store.
 *
 * Imports `DriverPresenceModule` for `DriverCandidatesRepo` rather than reaching
 * into Redis itself: the liveness rule and the §19.2 PostGIS degrade live there,
 * and a second reader that reimplemented either would be a second answer to
 * "who is available".
 */
@Module({
  imports: [AuthModule, DriverPresenceModule, PricingModule],
  controllers: [DriversNearbyController],
  providers: [DriversNearbyService],
})
export class DriversNearbyModule {}
