import { Global, Module } from '@nestjs/common';
import { BullMqAdapter } from './bullmq.adapter';
import { QUEUE } from './queue.port';

/**
 * Global for the same reason CacheModule and FleetEventsModule are: any feature
 * that needs background work should inject `@Inject(QUEUE)` without wiring.
 *
 * The adapter is also exported by class so `HealthModule` can read `stats()`
 * without widening the port with a method only it uses.
 */
@Global()
@Module({
  providers: [BullMqAdapter, { provide: QUEUE, useExisting: BullMqAdapter }],
  exports: [QUEUE, BullMqAdapter],
})
export class QueueModule {}
