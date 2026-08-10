import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { jobsQuerySchema, type FleetId, type JobsQuery } from '@towing/api-contracts';
import type { Response } from 'express';
import { CurrentFleet } from '../../common/tenancy/current-fleet.decorator';
import { FleetScopeGuard } from '../../common/tenancy/fleet-scope.guard';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JobsService } from './jobs.service';

@Controller('fleet/jobs')
@UseGuards(JwtAuthGuard, FleetScopeGuard)
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get()
  list(@CurrentFleet() fleetId: FleetId, @ZodQuery(jobsQuerySchema) query: JobsQuery) {
    return this.jobs.list(fleetId, query);
  }

  @Get('export.csv')
  exportCsv(
    @CurrentFleet() fleetId: FleetId,
    @ZodQuery(jobsQuerySchema) query: JobsQuery,
    @Res() res: Response,
  ) {
    return this.jobs.exportCsv(fleetId, query, res);
  }
}
