import type { CustomerProfile, CustomerProfileUpdate } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { profileMockSource } from './profileMockSource';
import { profileRestSource } from './profileRestSource';

export interface ProfileDataSource {
  getProfile(): Promise<CustomerProfile>;
  updateProfile(patch: CustomerProfileUpdate): Promise<CustomerProfile>;
}

export const profileDataSource: ProfileDataSource = env.useMocks ? profileMockSource : profileRestSource;
