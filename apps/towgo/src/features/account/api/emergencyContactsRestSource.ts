import type { EmergencyContact } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { EmergencyContactsDataSource } from './emergencyContactsDataSource';

export const emergencyContactsRestSource: EmergencyContactsDataSource = {
  list() {
    return apiFetch<EmergencyContact[]>('me/emergency-contacts');
  },

  create(input) {
    return apiFetch<EmergencyContact>('me/emergency-contacts', {
      method: 'POST',
      body: JSON.stringify(input),
      idempotent: true,
    });
  },

  async remove(contactId) {
    await apiFetch<void>(`me/emergency-contacts/${contactId}`, { method: 'DELETE', idempotent: true });
  },
};
