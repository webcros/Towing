import type { EmergencyContact, EmergencyContactCreate } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { emergencyContactsMockSource } from './emergencyContactsMockSource';
import { emergencyContactsRestSource } from './emergencyContactsRestSource';

/** No update: no edit UI exists or is planned for a contact, only add/remove (see the contract's own note). */
export interface EmergencyContactsDataSource {
  list(): Promise<EmergencyContact[]>;
  create(input: EmergencyContactCreate): Promise<EmergencyContact>;
  remove(contactId: string): Promise<void>;
}

export const emergencyContactsDataSource: EmergencyContactsDataSource = env.useMocks
  ? emergencyContactsMockSource
  : emergencyContactsRestSource;
