import type { DriverProfile } from '../types';
import { profileMockSource } from './profileMockSource';

/**
 * Boundary between UI and backend. Mock now; a REST implementation swaps in
 * later (selected by env.useMocks) with no change to query hooks or components.
 */
export interface ProfileDataSource {
  getProfile(): Promise<DriverProfile>;
}

export const profileDataSource: ProfileDataSource = profileMockSource;
