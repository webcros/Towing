import type {
  DriverGoOnline,
  DriverLocationAccepted,
  DriverLocationBatch,
  DriverPresenceResponse,
} from '@towing/api-contracts';
import { env } from '@/lib/env';
import { presenceMockSource } from './presenceMockSource';
import { presenceRestSource } from './presenceRestSource';

/**
 * §11.2/§11.8 — going online, and the location stream.
 *
 * The same `env.useMocks` seam every other feature has. Worth stating what mock
 * mode CANNOT prove here: there is no candidate store behind it, so "the driver
 * went online" in mocks means a local flag flipped, not that dispatch can find
 * them. The gate, the zone resolution and the GEO write are all server-side.
 */
export interface PresenceDataSource {
  goOnline(body: DriverGoOnline): Promise<DriverPresenceResponse>;
  goOffline(): Promise<DriverPresenceResponse>;
  sendLocation(body: DriverLocationBatch): Promise<DriverLocationAccepted>;
}

export const presenceDataSource: PresenceDataSource = env.useMocks
  ? presenceMockSource
  : presenceRestSource;
