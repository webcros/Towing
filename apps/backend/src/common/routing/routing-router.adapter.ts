import { Inject, Injectable, Logger } from '@nestjs/common';
import type { GeoPoint } from '@towing/api-contracts';
import { ENV, type Env } from '../../config/env';
import { MetricsService } from '../observability/metrics.service';
import { GoogleDistanceMatrixAdapter } from './google-distance-matrix.adapter';
import { HaversineRoutingAdapter } from './haversine-routing.adapter';
import type { RouteDistance, RoutingPort } from './routing.port';

/**
 * §19.2's degradation ladder for road distance, written in the same commit as
 * the primary it degrades from — the guiding decision the plan states outright,
 * because "a ladder that has never executed is not a ladder".
 *
 * WHY THE FALLBACK IS HERE AND NOT IN THE CALLER. `PricingService` should ask
 * for a distance and get one. If every caller had to catch `CircuitOpenError`
 * and remember to fall back, the second caller (Phase 15's booking creation,
 * Phase 18's ETA engine) would eventually forget, and the failure mode is a 500
 * on a fare quote during exactly the outage the ladder exists for.
 *
 * IT CATCHES EVERYTHING, DELIBERATELY. A breaker-open error, a timeout, a
 * malformed vendor body and an unexpected TypeError are all the same fact from
 * the customer's side: Google could not be asked. `ExternalCallPolicy` has
 * already counted the failure and tripped the breaker by the time we get here,
 * so swallowing it loses no signal — the vendor's health lives in
 * `external_calls_total` and `external_call_breaker_open`, and the degradation
 * itself is counted separately below.
 */
@Injectable()
export class RoutingRouterAdapter implements RoutingPort {
  private readonly logger = new Logger(RoutingRouterAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly google: GoogleDistanceMatrixAdapter,
    private readonly haversine: HaversineRoutingAdapter,
    private readonly metrics: MetricsService,
  ) {}

  async roadDistance(from: GeoPoint, to: GeoPoint): Promise<RouteDistance> {
    if (this.env.ROUTING_PROVIDER !== 'google_distance_matrix') {
      return this.haversine.roadDistance(from, to);
    }

    try {
      return await this.google.roadDistance(from, to);
    } catch (error) {
      this.metrics.observeExternalCall('routing_fallback', 'error');
      this.logger.warn(
        `Distance Matrix unavailable (${error instanceof Error ? error.name : 'unknown'}) — falling back to straight-line distance`,
      );
      return this.haversine.roadDistance(from, to);
    }
  }
}
