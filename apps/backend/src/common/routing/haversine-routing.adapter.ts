import { Injectable } from '@nestjs/common';
import type { GeoPoint } from '@towing/api-contracts';
import { haversineMeters } from '../../modules/pricing/pricing.math';
import type { RouteDistance, RoutingPort } from './routing.port';

/**
 * §19.2's "Google Maps/Directions degraded → straight-line ETA fallback".
 *
 * A PERMANENT PATH, NOT A STUB. This is the live default (`ROUTING_PROVIDER`
 * defaults to `haversine`) and will stay reachable after a Maps key exists,
 * because the breaker falls back to it every time Google is down. The same
 * standing as `DevPayoutAdapter`, `DiskStorageAdapter` and the four log
 * notification channels.
 *
 * IT RETURNS RAW GREAT-CIRCLE METRES AND DOES NOT SCALE THEM. Straight-line
 * distance under-states a road tow, and quoting the under-stated number loses
 * money on every degraded booking — but the correction factor is a §7.4 pricing
 * knob (`charge_config.haversine_road_factor`), not a property of geometry.
 * `PricingService` applies it, so this adapter stays free of pricing config and
 * the factor sits with the other admin-editable rates. Anything that needs true
 * geometry (a geofence check, a proximity sort) gets it unscaled.
 *
 * No duration: there is no honest driving time to infer from a straight line.
 * `null` is what makes the estimate omit an ETA rather than invent one.
 */
@Injectable()
export class HaversineRoutingAdapter implements RoutingPort {
  readonly source = 'haversine' as const;

  async roadDistance(from: GeoPoint, to: GeoPoint): Promise<RouteDistance> {
    return {
      distanceMeters: Math.round(haversineMeters(from, to)),
      durationSeconds: null,
      source: 'haversine',
    };
  }
}
