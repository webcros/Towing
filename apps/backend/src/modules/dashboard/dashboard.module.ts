import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  // ComplianceModule for AlertsService: since Phase 6 the dashboard's alert
  // feed reads the same stored rows `/v1/fleet/alerts` serves.
  imports: [AuthModule, ComplianceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  // Exported for the realtime MetricsBroadcaster: `ops:metrics` carries the same
  // recomputed KPI object this service produces, so there is exactly one
  // definition of what a KPI means.
  exports: [DashboardService],
})
export class DashboardModule {}
