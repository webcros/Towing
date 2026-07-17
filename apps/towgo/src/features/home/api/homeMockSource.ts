import type { LatLng } from '@/types/geo';
import { env } from '@/lib/env';
import type { HomeDataSource } from './homeDataSource';
import type { NearbyDriver } from '../types';
import { nearbyDriversMock } from '../mocks/nearbyDrivers.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock data source with realistic latency. `EXPO_PUBLIC_MOCK_DRIVERS_STATE`
 * forces empty/error so the §10.9 states can be exercised without a backend.
 */
export const homeMockSource: HomeDataSource = {
  async getNearbyDrivers(_near: LatLng): Promise<NearbyDriver[]> {
    await delay(700);
    if (env.mockDriversState === 'error') {
      throw new Error('Failed to load nearby drivers');
    }
    if (env.mockDriversState === 'empty') {
      return [];
    }
    return nearbyDriversMock;
  },
};
