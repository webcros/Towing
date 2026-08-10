import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';

/**
 * The admin auth realm (§9.4, §15.2).
 *
 * `AdminAuditService` is exported because `modules/admin-drivers` (Phase 11),
 * Phase 19's payout approvals and Phase 20's live-ops actions all record
 * through it — it is the sole writer of `admin_actions` and should stay that
 * way.
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, AdminAuditService],
  exports: [AdminAuthService, AdminAuditService],
})
export class AdminAuthModule {}
