import { Module } from '@nestjs/common';
import { GoogleDistanceMatrixAdapter } from './google-distance-matrix.adapter';
import { HaversineRoutingAdapter } from './haversine-routing.adapter';
import { RoutingRouterAdapter } from './routing-router.adapter';
import { ROUTING } from './routing.port';

/**
 * The `money.module.ts` `PAYOUT_PROVIDER` idiom, one level up: rather than the
 * factory picking an adapter, it always binds the ROUTER, which picks per call
 * and degrades. The provider switch still lives in env; what changes is that a
 * `google_distance_matrix` deployment keeps working when Google does not.
 *
 * Both concrete adapters are instantiated whichever way `ROUTING_PROVIDER` is
 * set — which is exactly why neither constructor may validate a credential or
 * open a connection. `GoogleDistanceMatrixAdapter` does its check in
 * `onModuleInit`, guarded on the switch.
 *
 * Not `@Global()`: unlike storage or notifications this has exactly one consumer
 * family (pricing, and later booking creation and the ETA engine), so the import
 * edge is worth declaring.
 */
@Module({
  providers: [
    HaversineRoutingAdapter,
    GoogleDistanceMatrixAdapter,
    RoutingRouterAdapter,
    { provide: ROUTING, useExisting: RoutingRouterAdapter },
  ],
  exports: [ROUTING, HaversineRoutingAdapter, GoogleDistanceMatrixAdapter],
})
export class RoutingModule {}
