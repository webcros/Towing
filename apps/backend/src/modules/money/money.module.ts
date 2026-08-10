import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { AuthModule } from '../auth/auth.module';
import { DevPayoutAdapter } from './dev-payout.adapter';
import { EarningsProjectorService } from './earnings-projector.service';
import { EarningsController } from './earnings.controller';
import { EarningsRepo } from './earnings.repo';
import { EarningsService } from './earnings.service';
import { ProfileCompleteGuard } from '../../common/tenancy/profile-complete.guard';
import { PayoutReconcileService } from './payout-reconcile.service';
import { PAYOUT_PROVIDER, type PayoutProviderPort } from './payout-provider.port';
import { PayoutsController } from './payouts.controller';
import { PayoutsRepo } from './payouts.repo';
import { PayoutsService } from './payouts.service';
import { RazorpayRouteAdapter } from './razorpay-route.adapter';
import { ReportsController } from './reports.controller';
import { ReportsRepo } from './reports.repo';
import { ReportsService } from './reports.service';

/**
 * The money domain: the earnings projection and its nightly reconciliation,
 * the §9.3.7/§9.3.8 read endpoints, and the payout write path.
 *
 * `AuthModule` is the only import — ConfigModule, DbModule, LedgerModule,
 * CacheModule, FleetEventsModule, QueueModule and NotificationsModule are all
 * `@Global()`.
 */
@Module({
  imports: [AuthModule],
  controllers: [EarningsController, ReportsController, PayoutsController],
  providers: [
    EarningsProjectorService,
    EarningsService,
    EarningsRepo,
    ReportsService,
    ReportsRepo,
    PayoutsService,
    PayoutsRepo,
    PayoutReconcileService,
    ProfileCompleteGuard,
    // Both adapters are instantiated whichever one the factory picks — which is
    // exactly why neither constructor may validate credentials or open a
    // connection. RazorpayRouteAdapter does that in `onModuleInit`, guarded.
    DevPayoutAdapter,
    RazorpayRouteAdapter,
    {
      provide: PAYOUT_PROVIDER,
      inject: [ENV, DevPayoutAdapter, RazorpayRouteAdapter],
      useFactory: (env: Env, dev: DevPayoutAdapter, razorpay: RazorpayRouteAdapter): PayoutProviderPort =>
        env.PAYOUT_PROVIDER === 'razorpay_route' ? razorpay : dev,
    },
  ],
  // `DevPayoutAdapter` is exported alongside the token — the `QueueModule`
  // pattern — so specs can reach the concrete adapter without widening the port.
  exports: [
    EarningsProjectorService,
    PayoutsService,
    PayoutReconcileService,
    PAYOUT_PROVIDER,
    DevPayoutAdapter,
  ],
})
export class MoneyModule {}
