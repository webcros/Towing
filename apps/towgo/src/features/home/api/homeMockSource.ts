import { env } from '@/lib/env';
import type { LatLng } from '@/types/geo';
import type { NearbySupply } from '../types';
import type { HomeDataSource } from './homeDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Deterministic offsets, so the demo map does not reshuffle on every poll. */
const OFFSETS = [
  { lat: 0.0032, lng: 0.0041 },
  { lat: -0.0027, lng: 0.0018 },
  { lat: 0.0015, lng: -0.0036 },
  { lat: -0.0041, lng: -0.0012 },
  { lat: 0.0008, lng: 0.0052 },
];

/**
 * Mock supply, in the §11.9 shape. It scatters anonymous points around whatever
 * the caller asked about rather than returning fixed coordinates, so panning the
 * demo map keeps showing drivers instead of leaving them behind in Bengaluru.
 */
export const homeMockSource: HomeDataSource = {
  async getNearbyDrivers(near: LatLng): Promise<NearbySupply> {
    await delay(500);
    if (env.mockNearbyState === 'error') throw new Error('Failed to load nearby drivers');
    if (env.mockNearbyState === 'empty') {
      return { count: 0, points: [], coarsenedToMeters: 100, degraded: false };
    }

    return {
      count: OFFSETS.length,
      points: OFFSETS.map((offset) => ({
        latitude: near.latitude + offset.lat,
        longitude: near.longitude + offset.lng,
      })),
      coarsenedToMeters: 100,
      degraded: false,
    };
  },
};
