import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  nearbyDriversQuerySchema,
  type NearbyDriversQuery,
  type NearbyDriversResponse,
} from '@towing/api-contracts';
import { ThrottleBucket } from '../../common/throttling/throttler.config';
import { ZodQuery } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Realms } from '../auth/realm.decorator';
import { DriversNearbyService } from './drivers-nearby.service';

/**
 * `GET /v1/drivers/nearby` (§11.9).
 *
 * ITS OWN CONTROLLER, NOT A ROUTE ON `DriversController`. That one is
 * `fleet/drivers` behind `FleetScopeGuard` — a tenant's own roster. This is a
 * marketplace-wide supply read for a customer, and hanging it off the fleet
 * controller would have meant either weakening that guard or explaining why one
 * route on it ignores the tenant.
 *
 * `realtime` bucket: a home screen polls this every few seconds while it is
 * open, which is realtime traffic wearing a REST costume, not a page read.
 */
@Controller('drivers')
@UseGuards(JwtAuthGuard)
@Realms('customer')
export class DriversNearbyController {
  constructor(private readonly nearby: DriversNearbyService) {}

  @Get('nearby')
  @ThrottleBucket('realtime')
  get(
    @ZodQuery(nearbyDriversQuerySchema) query: NearbyDriversQuery,
  ): Promise<NearbyDriversResponse> {
    return this.nearby.nearby(query);
  }
}
