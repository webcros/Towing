import { Module } from '@nestjs/common';
import { RoutingModule } from '../../common/routing/routing.module';
import { AuthModule } from '../auth/auth.module';
import { PricingConfigRepo } from './pricing-config.repo';
import { PricingController } from './pricing.controller';
import { PricingService } from './pricing.service';
import { ServicesService } from './services.service';
import { ZoneResolverService } from './zone-resolver.service';

/**
 * §7 pricing, §6.10 zone resolution and the Appendix B catalogue.
 *
 * `AuthModule` for `JwtAuthGuard`, `RoutingModule` for `ROUTING`. Everything
 * else it uses — ConfigModule, DbModule, CacheModule — is `@Global()`, the same
 * note `money.module.ts` carries.
 *
 * Exports its three services because the admin config module invalidates their
 * caches on write, and because Phase 15's booking creation locks a fare through
 * `PricingService` rather than re-deriving one.
 */
@Module({
  imports: [AuthModule, RoutingModule],
  controllers: [PricingController],
  providers: [PricingService, PricingConfigRepo, ServicesService, ZoneResolverService],
  exports: [PricingService, PricingConfigRepo, ServicesService, ZoneResolverService],
})
export class PricingModule {}
