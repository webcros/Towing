import type { ServiceCatalogItem } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { ServicesDataSource } from './servicesDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * The nine Appendix B rows the backend seeds, verbatim. Kept in step with
 * `apps/backend/src/db/seed/fixtures.ts`'s `SERVICE_CATALOG` — a mock that
 * disagrees with the seed is worse than no mock, because mocks-on and mocks-off
 * then render different catalogues and only one of them gets reviewed.
 */
const CATALOG: ServiceCatalogItem[] = [
  { slug: 'car_tow', serviceType: 'tow', defaultVehicleClass: null, name: 'Car tow', description: 'Standard car towing to your chosen destination.', requiresDrop: true, displayOrder: 0 },
  { slug: 'bike_tow', serviceType: 'tow', defaultVehicleClass: 'wheel_lift', name: 'Bike tow', description: 'Two-wheeler recovery and transport.', requiresDrop: true, displayOrder: 1 },
  { slug: 'flatbed_tow', serviceType: 'tow', defaultVehicleClass: 'flatbed', name: 'Flatbed tow', description: 'Damage-free transport for luxury, SUV and electric vehicles.', requiresDrop: true, displayOrder: 2 },
  { slug: 'wheel_lift_tow', serviceType: 'tow', defaultVehicleClass: 'wheel_lift', name: 'Wheel-lift tow', description: 'Quick city recovery for short distances.', requiresDrop: true, displayOrder: 3 },
  { slug: 'battery', serviceType: 'battery', defaultVehicleClass: null, name: 'Battery jumpstart', description: 'On-site jumpstart to get you moving again.', requiresDrop: false, displayOrder: 4 },
  { slug: 'flat_tyre', serviceType: 'flat_tyre', defaultVehicleClass: null, name: 'Flat-tyre support', description: 'Tyre change or on-the-spot repair.', requiresDrop: false, displayOrder: 5 },
  { slug: 'fuel', serviceType: 'fuel', defaultVehicleClass: null, name: 'Fuel delivery', description: 'Emergency fuel delivered to your location.', requiresDrop: false, displayOrder: 6 },
  { slug: 'breakdown', serviceType: 'breakdown', defaultVehicleClass: null, name: 'Breakdown assistance', description: 'General on-site diagnosis and help.', requiresDrop: false, displayOrder: 7 },
  { slug: 'accident_recovery', serviceType: 'accident_recovery', defaultVehicleClass: 'flatbed', name: 'Accident recovery', description: 'Post-accident recovery with specialist equipment.', requiresDrop: true, displayOrder: 8 },
];

export const servicesMockSource: ServicesDataSource = {
  async list() {
    await delay(400);
    if (env.mockServicesState === 'error') throw new Error('Mock services error');
    if (env.mockServicesState === 'empty') return [];
    return CATALOG;
  },
};
