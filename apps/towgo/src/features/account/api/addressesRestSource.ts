import type { SavedAddress } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { AddressesDataSource } from './addressesDataSource';

export const addressesRestSource: AddressesDataSource = {
  list() {
    return apiFetch<SavedAddress[]>('me/addresses');
  },

  create(input) {
    return apiFetch<SavedAddress>('me/addresses', {
      method: 'POST',
      body: JSON.stringify(input),
      idempotent: true,
    });
  },

  update(addressId, patch) {
    return apiFetch<SavedAddress>(`me/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
      idempotent: true,
    });
  },

  async remove(addressId) {
    await apiFetch<void>(`me/addresses/${addressId}`, { method: 'DELETE', idempotent: true });
  },
};
