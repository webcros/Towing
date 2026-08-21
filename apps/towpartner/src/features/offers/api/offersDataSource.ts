import type { DriverJob, JobReject } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { JobOffer } from '../types';
import { offersMockSource } from './offersMockSource';
import { offersRestSource } from './offersRestSource';

/**
 * §6.3's offer surface.
 *
 * Phase 17 gave this its REST half. `getCurrentOffer` was mock-only and its own
 * header said "a realtime (Socket.io) source swaps in later" — it did, and the
 * socket sits BESIDE this rather than replacing it: a frame is not a durable
 * delivery, so a driver whose connection dropped inside the twenty-second window
 * resyncs through this route (§19.2).
 */
export interface OffersDataSource {
  /** `null` means no request is currently pending. */
  getCurrentOffer(): Promise<JobOffer | null>;
  /** `null` when the driver is idle. */
  getCurrentJob(): Promise<DriverJob | null>;
  accept(bookingId: string): Promise<DriverJob>;
  reject(bookingId: string, body?: JobReject): Promise<void>;
}

export const offersDataSource: OffersDataSource = env.useMocks
  ? offersMockSource
  : offersRestSource;
