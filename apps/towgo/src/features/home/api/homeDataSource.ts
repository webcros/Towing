import { env } from '@/lib/env';
import type { LatLng } from '@/types/geo';
import type { NearbySupply } from '../types';
import { homeMockSource } from './homeMockSource';
import { homeRestSource } from './homeRestSource';

/**
 * Boundary between the home screen and the backend.
 *
 * Phase 16 gave this its REST half. It was the LAST feature data source in the
 * app still hard-wired to its mock — every other one has had the `env.useMocks`
 * ternary since Phase 12, and `bookingsDataSource` lost the same distinction in
 * Phase 15.
 */
export interface HomeDataSource {
  /** §11.9 — supply near a point, viewport-scoped. */
  getNearbyDrivers(near: LatLng, radiusKm?: number): Promise<NearbySupply>;
}

export const homeDataSource: HomeDataSource = env.useMocks ? homeMockSource : homeRestSource;
