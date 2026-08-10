import { Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { alertsQuerySchema, type AlertsQuery, type FleetId } from '@towing/api-contracts';
import { CurrentFleet } from '../../common/tenancy/current-fleet.decorator';
import { FleetScopeGuard } from '../../common/tenancy/fleet-scope.guard';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AlertsService } from './alerts.service';
import { ComplianceService } from './compliance.service';

@Controller('fleet/alerts')
@UseGuards(JwtAuthGuard, FleetScopeGuard)
export class AlertsController {
  constructor(
    private readonly alerts: AlertsService,
    private readonly compliance: ComplianceService,
  ) {}

  @Get()
  list(@CurrentFleet() fleetId: FleetId, @ZodQuery(alertsQuerySchema) query: AlertsQuery) {
    return this.alerts.list(fleetId, query);
  }

  /**
   * Re-runs the sweep for this fleet only.
   *
   * Exists because the alternative is telling an operator who just renewed a
   * document to wait up to an hour for the truck to rejoin dispatch. Safe to
   * spam: the sweep is idempotent, and it is scoped to the caller's own fleet.
   */
  @Post('recheck')
  @HttpCode(HttpStatus.OK)
  async recheck(@CurrentFleet() fleetId: FleetId) {
    const result = await this.compliance.sweep('manual', fleetId);
    return {
      expired: result.expired,
      expiringSoon: result.expiringSoon,
      trucksBlocked: result.trucksBlocked,
      trucksCleared: result.trucksCleared,
      alertsOpened: result.alertsOpened,
      alertsResolved: result.alertsResolved,
    };
  }
}
