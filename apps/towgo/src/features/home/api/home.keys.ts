/** Query key factory for Home data. */
export const homeKeys = {
  all: ['home'] as const,
  /**
   * The radius is part of the key: the same centre at 5 km and at 20 km are
   * different questions with different answers, and omitting it would serve one
   * from the other's cache.
   */
  nearbyDrivers: (lat?: number, lng?: number, radiusKm?: number) =>
    ['home', 'nearbyDrivers', lat ?? null, lng ?? null, radiusKm ?? null] as const,
};
