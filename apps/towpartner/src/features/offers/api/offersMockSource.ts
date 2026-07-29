import { env } from '@/lib/env';
import type { OffersDataSource } from './offersDataSource';
import type { JobOffer } from '../types';
import { offerMock } from '../mocks/offer.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock incoming offer. `EXPO_PUBLIC_MOCK_OFFER_STATE=none` returns no request
 * so the empty state can be previewed without a backend.
 */
export const offersMockSource: OffersDataSource = {
  async getCurrentOffer(): Promise<JobOffer | null> {
    await delay(500);
    if (env.mockOfferState === 'none') {
      return null;
    }
    return offerMock;
  },
};
