import type {
  DriverGoOnline,
  DriverLocationAccepted,
  DriverLocationBatch,
  DriverPresenceResponse,
} from '@towing/api-contracts';
import { LOW_ACCURACY_METERS, PING_CADENCE } from '@towing/api-contracts';
import { ApiClientError } from '@/lib/api/errors';
import { getMockKycStatus } from '@/features/kyc/api/kycMockSource';
import type { PresenceDataSource } from './presenceDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let mockSeq = 0;

/** Mirrors the server's defaults so the toggle and the cadence behave the same offline. */
function presence(isOnline: boolean): DriverPresenceResponse {
  return {
    isOnline,
    zoneId: isOnline ? '00000000-0000-4000-8000-000000000001' : null,
    zoneName: isOnline ? 'Bengaluru Metro' : null,
    pingIntervalMs: isOnline ? PING_CADENCE.idleMs : PING_CADENCE.offlineMs,
    staleAfterMs: 15_000,
    lowAccuracyMeters: LOW_ACCURACY_METERS,
    seq: 0,
  };
}

export const presenceMockSource: PresenceDataSource = {
  async goOnline(_body: DriverGoOnline) {
    await delay(400);
    // Mirrors `KycApprovedGuard` — §3.1 layer 3 is the one gate a signed-in
    // driver can still be turned away by, and the toggle must show that in mock
    // mode too or the approval flow cannot be demoed at all.
    if (getMockKycStatus() !== 'approved') {
      throw new ApiClientError(403, 'forbidden', 'KYC approval required', {
        reason: 'kyc_not_approved',
      });
    }
    mockSeq = 0;
    return presence(true);
  },

  async goOffline() {
    await delay(250);
    return presence(false);
  },

  async sendLocation(body: DriverLocationBatch): Promise<DriverLocationAccepted> {
    await delay(80);
    // The real `seq` rule, locally: anything at or below what we have stored is
    // discarded. Without it the mock would accept a replayed buffer that the
    // server rejects, and the buffer's clear-up-to logic would go untested until
    // the first real device.
    let accepted = 0;
    let discarded = 0;
    for (const ping of body.pings) {
      if (ping.seq > mockSeq) {
        mockSeq = ping.seq;
        accepted += 1;
      } else {
        discarded += 1;
      }
    }
    return { accepted, discarded, seq: mockSeq };
  },
};
