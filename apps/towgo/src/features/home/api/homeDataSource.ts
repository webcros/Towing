import type { LatLng } from '@/types/geo';
import type { NearbyDriver } from '../types';
import { homeMockSource } from './homeMockSource';

/**
 * Boundary between UI and backend. The mock implementation satisfies it today;
 * a REST implementation drops in later selected by `env.useMocks`, with no
 * change to query hooks or components.
 */
export interface HomeDataSource {
  getNearbyDrivers(near: LatLng): Promise<NearbyDriver[]>;
}

// When the backend exists, add `homeRestSource` and switch on env.useMocks here.
export const homeDataSource: HomeDataSource = homeMockSource;
