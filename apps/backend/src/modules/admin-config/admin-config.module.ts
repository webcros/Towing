import { Module } from '@nestjs/common';
import { AdminAuthModule } from '../admin-auth/admin-auth.module';
import { AuthModule } from '../auth/auth.module';
import { BookingsModule } from '../bookings/bookings.module';
import { PricingModule } from '../pricing/pricing.module';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { AdminDispatchService } from './admin-dispatch.service';

/**
 * `AdminAuthModule` for `AdminAuditService` — the SOLE writer of `admin_actions`
 * (§20.4), imported rather than re-implemented. `PricingModule` for
 * `PricingConfigRepo`, whose cache every write here has to invalidate.
 *
 * `BookingsModule` (Phase 17) for `DispatchConfigRepo` — §16.5's dispatch
 * config lives on this controller because it is the same kind of thing as
 * pricing and commission (admin-editable, audited, no deploy), and its cache
 * needs the same invalidation. The kill switches are `@Global()`.
 */
@Module({
  imports: [AuthModule, AdminAuthModule, PricingModule, BookingsModule],
  controllers: [AdminConfigController],
  providers: [AdminConfigService, AdminDispatchService],
})
export class AdminConfigModule {}
