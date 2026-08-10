import { Controller, Get, UseGuards } from '@nestjs/common';
import type { FleetId } from '@towing/api-contracts';
import { CurrentFleet } from '../../common/tenancy/current-fleet.decorator';
import { FleetScopeGuard } from '../../common/tenancy/fleet-scope.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('fleet/dashboard')
@UseGuards(JwtAuthGuard, FleetScopeGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  summary(@CurrentFleet() fleetId: FleetId) {
    return this.dashboard.getSummary(fleetId);
  }
}
