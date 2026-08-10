import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { reportQuerySchema, type FleetId, type ReportQuery } from '@towing/api-contracts';
import type { Response } from 'express';
import { CurrentFleet } from '../../common/tenancy/current-fleet.decorator';
import { FleetScopeGuard } from '../../common/tenancy/fleet-scope.guard';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportsService } from './reports.service';

/** §9.3.8: per truck / driver / period, with CSV export. */
@Controller('fleet/reports')
@UseGuards(JwtAuthGuard, FleetScopeGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  generate(@CurrentFleet() fleetId: FleetId, @ZodQuery(reportQuerySchema) query: ReportQuery) {
    return this.reports.generate(fleetId, query);
  }

  @Get('export.csv')
  exportCsv(
    @CurrentFleet() fleetId: FleetId,
    @ZodQuery(reportQuerySchema) query: ReportQuery,
    @Res() res: Response,
  ) {
    return this.reports.exportCsv(fleetId, query, res);
  }
}
