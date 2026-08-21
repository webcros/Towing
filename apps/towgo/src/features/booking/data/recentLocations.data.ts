export type RecentLocation = {
  id: string;
  name: string;
  address: string;
  /**
   * Real coordinates for the named place.
   *
   * Added in Phase 14: `POST /v1/pricing/estimate` point-in-polygons the pickup
   * against `service_zones` and measures the drop, so a location with no
   * coordinate cannot be priced at all. Places autocomplete and a draggable pin
   * are Phase 15 (§9.1.5 step 2) — until then this list is the only way to put a
   * real destination into the booking, and a coordinate-less mock would have
   * left the whole fare sheet unreachable.
   */
  coords: { latitude: number; longitude: number };
};

// Mocked recent / saved locations (real history + Places search come later).
export const recentLocations: RecentLocation[] = [
  { id: 'r1', name: 'MG Road', address: 'Bengaluru, Karnataka, India', coords: { latitude: 12.9756, longitude: 77.6068 } },
  { id: 'r2', name: 'Koramangala', address: '5th Block, Bengaluru, Karnataka', coords: { latitude: 12.9345, longitude: 77.6266 } },
  // Deliberately kept although it sits OUTSIDE the seeded Bengaluru zone
  // (lat 13.1986 > the polygon's 13.15 edge): it is the one entry that
  // exercises §9.1.5's "pin moved outside zone" path against a real 422.
  { id: 'r3', name: 'Kempegowda Intl. Airport', address: 'Devanahalli, Bengaluru', coords: { latitude: 13.1986, longitude: 77.7066 } },
  { id: 'r4', name: 'HSR Layout', address: 'Sector 2, Bengaluru, Karnataka', coords: { latitude: 12.9116, longitude: 77.6389 } },
  { id: 'r5', name: 'Indiranagar', address: '100 Feet Road, Bengaluru', coords: { latitude: 12.9784, longitude: 77.6408 } },
  { id: 'r6', name: 'Whitefield', address: 'ITPL Main Road, Bengaluru', coords: { latitude: 12.9855, longitude: 77.7367 } },
  { id: 'r7', name: 'Majestic Bus Stand', address: 'Kempegowda, Bengaluru', coords: { latitude: 12.9776, longitude: 77.5713 } },
];
