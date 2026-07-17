/** Query key factory for Home data. */
export const homeKeys = {
  all: ['home'] as const,
  nearbyDrivers: (lat?: number, lng?: number) =>
    ['home', 'nearbyDrivers', lat ?? null, lng ?? null] as const,
};
