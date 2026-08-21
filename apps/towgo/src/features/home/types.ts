import type { LatLng } from '@/types/geo';

export type VehicleClass = 'wheel_lift' | 'flatbed';

/**
 * §11.9's nearby supply — a COUNT and coarsened positions, nothing more.
 *
 * WHAT WAS DELETED HERE IS THE POINT. Until Phase 16 this type carried `name`,
 * `vehiclePlate`, `rating`, `etaMinutes` and a `vehicleClass`, all invented by
 * Phase 12's mock and never rendered. §11.9 forbids identity pre-assignment:
 * showing "Suresh, 4.8★, 3 min away" before dispatch has run promises a
 * specific driver the matcher has not chosen and may never offer the job to. The
 * server's response has no such fields either — the contract and this type were
 * cut together.
 *
 * Positions are snapped onto a ~100 m grid server-side. `coarsenedToMeters`
 * travels with them so the marker can be drawn at the size of the uncertainty
 * rather than as a precise dot.
 */
export type NearbySupply = {
  /** Honest total, counted before coarsening collapsed co-located drivers. */
  count: number;
  points: LatLng[];
  coarsenedToMeters: number;
  /** Redis was unavailable and this came from the last ~30s flush (§19.2). */
  degraded: boolean;
};

export type QuickActionId = 'book' | 'schedule' | 'roadside' | 'support';
