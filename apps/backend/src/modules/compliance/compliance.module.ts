import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { ComplianceService } from './compliance.service';

/**
 * The compliance engine (§9.3.4) and the stored-alert feed it produces.
 *
 * `AlertsService` is exported because `DashboardService` reads the same rows —
 * the dashboard's alert list stopped being derived-on-read in Phase 6, and
 * having two definitions of "what is an alert" is exactly what that change was
 * meant to end.
 */
@Module({
  imports: [AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService, ComplianceService],
  exports: [AlertsService, ComplianceService],
})
export class ComplianceModule {}
