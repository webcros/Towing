import { Module } from '@nestjs/common';
import { MoneyModule } from '../money/money.module';
import { HealthController } from './health.controller';

@Module({
  // For `EarningsProjectorService` — `/health/ledger` serves the nightly
  // reconciliation's last report alongside a live invariant check.
  imports: [MoneyModule],
  controllers: [HealthController],
})
export class HealthModule {}
