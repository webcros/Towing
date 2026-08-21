/** Query key factory for the §16.2 service catalogue. */
export const servicesKeys = {
  all: ['services'] as const,
  catalog: () => ['services', 'catalog'] as const,
};
