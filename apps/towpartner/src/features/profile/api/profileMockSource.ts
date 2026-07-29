import { env } from '@/lib/env';
import type { ProfileDataSource } from './profileDataSource';
import type { DriverProfile } from '../types';
import { profileMock } from '../mocks/profile.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock profile with realistic latency. `EXPO_PUBLIC_MOCK_PROFILE_STATE`
 * forces error so the §10.9 state can be exercised without a backend.
 */
export const profileMockSource: ProfileDataSource = {
  async getProfile(): Promise<DriverProfile> {
    await delay(500);
    if (env.mockProfileState === 'error') {
      throw new Error('Failed to load profile');
    }
    return profileMock;
  },
};
