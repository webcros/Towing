import type {
  DriverGoOnline,
  DriverLocationAccepted,
  DriverLocationBatch,
  DriverPresenceResponse,
} from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { PresenceDataSource } from './presenceDataSource';

export const presenceRestSource: PresenceDataSource = {
  goOnline(body: DriverGoOnline) {
    return apiFetch<DriverPresenceResponse>('driver/online', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  goOffline() {
    return apiFetch<DriverPresenceResponse>('driver/offline', { method: 'POST' });
  },

  /**
   * NO `Idempotency-Key`, and NOT enqueued on failure.
   *
   * Both omissions are deliberate. `seq` already makes a replayed batch a no-op
   * server-side, so the key would buy nothing. And the durable mutation queue is
   * the wrong home for this: it replays each entry as its own request, which
   * over a recovering connection arrive shuffled and get discarded as stale.
   * `pingBuffer` holds the backlog instead and flushes it as one ordered batch.
   */
  sendLocation(body: DriverLocationBatch) {
    return apiFetch<DriverLocationAccepted>('driver/location', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
