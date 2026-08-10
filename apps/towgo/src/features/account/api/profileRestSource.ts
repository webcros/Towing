import type { CustomerProfile } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { ProfileDataSource } from './profileDataSource';

export const profileRestSource: ProfileDataSource = {
  getProfile() {
    return apiFetch<CustomerProfile>('me');
  },

  updateProfile(patch) {
    return apiFetch<CustomerProfile>('me', {
      method: 'PUT',
      body: JSON.stringify(patch),
      idempotent: true,
    });
  },
};
