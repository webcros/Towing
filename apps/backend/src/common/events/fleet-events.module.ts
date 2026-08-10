import { Global, Module } from '@nestjs/common';
import { FleetEventsService } from './fleet-events.service';

/** Global for the same reason CacheModule is: every mutation path needs it. */
@Global()
@Module({
  providers: [FleetEventsService],
  exports: [FleetEventsService],
})
export class FleetEventsModule {}
