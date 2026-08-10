import { Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { DashboardModule } from '../modules/dashboard/dashboard.module';
import { FleetGateway } from './fleet.gateway';
import { MetricsBroadcasterService } from './metrics-broadcaster.service';
import { PositionsRepo } from './positions.repo';
import { PositionsService } from './positions.service';
import { RealtimeController } from './realtime.controller';
import { RealtimeRelayService } from './realtime-relay.service';
import { RealtimeSubscriberService } from './realtime-subscriber.service';
import { WsTicketService } from './ws-ticket.service';

/**
 * Realtime transport (§11, §16.6, §18). `AuthModule` is imported for the same
 * reason every other feature module imports it: that is where `JwtAuthGuard` and
 * `FleetScopeGuard` are provided.
 *
 * Redis comes from the `@Global()` RedisModule, so there is nothing to wire.
 */
@Module({
  imports: [AuthModule, DashboardModule],
  controllers: [RealtimeController],
  providers: [
    FleetGateway,
    WsTicketService,
    RealtimeSubscriberService,
    RealtimeRelayService,
    MetricsBroadcasterService,
    PositionsRepo,
    PositionsService,
  ],
  exports: [FleetGateway, WsTicketService],
})
export class RealtimeModule {}
