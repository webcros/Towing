import type {
  CurrentJobResponse,
  CurrentOfferResponse,
  DriverJob,
  JobAcceptResponse,
  JobReject,
} from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { JobOffer } from '../types';
import type { OffersDataSource } from './offersDataSource';

export const offersRestSource: OffersDataSource = {
  async getCurrentOffer(): Promise<JobOffer | null> {
    const { offer } = await apiFetch<CurrentOfferResponse>('driver/offers/current');
    return offer;
  },

  async getCurrentJob(): Promise<DriverJob | null> {
    const { job } = await apiFetch<CurrentJobResponse>('driver/jobs/current');
    return job;
  },

  /**
   * NO `Idempotency-Key`, and NOT enqueued on failure.
   *
   * The offer already has a stronger mechanism: a double tap finds its
   * `dispatch_attempts` row no longer `offered` and takes the same graceful 409
   * a losing racer does, which is the correct answer to "did my first tap work?"
   * either way. And a queued accept replayed on reconnect would be accepting a
   * job that expired minutes ago — the one mutation that must NOT survive being
   * offline.
   */
  async accept(bookingId: string): Promise<DriverJob> {
    const { job } = await apiFetch<JobAcceptResponse>(`jobs/${bookingId}/accept`, {
      method: 'POST',
    });
    return job;
  },

  async reject(bookingId: string, body: JobReject = {}): Promise<void> {
    await apiFetch<void>(`jobs/${bookingId}/reject`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
