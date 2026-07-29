import type { JobOffer } from '../types';
import { offersMockSource } from './offersMockSource';

/**
 * Boundary between UI and backend. Mock now; a realtime (Socket.io) source
 * swaps in later with no change to query hooks or components.
 */
export interface OffersDataSource {
  /** `null` means no request is currently available. */
  getCurrentOffer(): Promise<JobOffer | null>;
}

export const offersDataSource: OffersDataSource = offersMockSource;
