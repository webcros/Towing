import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import {
  earningsQuerySchema,
  splitsQuerySchema,
  statementQuerySchema,
  type EarningsQuery,
  type FleetId,
  type SplitsQuery,
  type StatementQuery,
} from '@towing/api-contracts';
import type { Response } from 'express';
import { CurrentFleet } from '../../common/tenancy/current-fleet.decorator';
import { FleetScopeGuard } from '../../common/tenancy/fleet-scope.guard';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EarningsService } from './earnings.service';

/** §9.3.7 and §16.4: `GET /fleet/earnings`, `/fleet/earnings/split`. */
@Controller('fleet/earnings')
@UseGuards(JwtAuthGuard, FleetScopeGuard)
export class EarningsController {
  constructor(private readonly earnings: EarningsService) {}

  @Get()
  summary(@CurrentFleet() fleetId: FleetId, @ZodQuery(earningsQuerySchema) query: EarningsQuery) {
    return this.earnings.summary(fleetId, query);
  }

  @Get('split')
  splits(@CurrentFleet() fleetId: FleetId, @ZodQuery(splitsQuerySchema) query: SplitsQuery) {
    return this.earnings.splits(fleetId, query);
  }

  /**
   * Declared before no route could shadow it, but note the ordering rule
   * anyway: literal segments must precede any parameterised sibling, and this
   * controller deliberately has none.
   */
  @Get('statement.csv')
  statement(
    @CurrentFleet() fleetId: FleetId,
    @ZodQuery(statementQuerySchema) query: StatementQuery,
    @Res() res: Response,
  ) {
    return this.earnings.statementCsv(fleetId, query.month, res);
  }
}
