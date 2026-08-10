import { Module } from '@nestjs/common';
import { ProfileCompleteGuard } from '../../common/tenancy/profile-complete.guard';
import { AuthModule } from '../auth/auth.module';
import { MoneyModule } from '../money/money.module';
import { SettingsController } from './settings.controller';
import { SettingsRepo } from './settings.repo';
import { SettingsService } from './settings.service';

@Module({
  // MoneyModule exports PAYOUT_PROVIDER — the same adapter Track B Phase 19
  // uses to onboard drivers, so there is one vendor integration, not two.
  imports: [AuthModule, MoneyModule],
  controllers: [SettingsController],
  providers: [SettingsService, SettingsRepo, ProfileCompleteGuard],
})
export class SettingsModule {}
