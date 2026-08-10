import type { EmergencyContact } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { EmergencyContactsDataSource } from './emergencyContactsDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let idCounter = 100;
const nextId = () => `mock-contact-${(idCounter += 1)}`;

let contacts: EmergencyContact[] = [
  { id: 'c1', name: 'Priya Sharma', phone: '+919876500001', relation: 'Spouse' },
];

export const emergencyContactsMockSource: EmergencyContactsDataSource = {
  async list() {
    await delay(400);
    if (env.mockAccountState === 'error') {
      throw new Error('Failed to load emergency contacts');
    }
    if (env.mockAccountState === 'empty') {
      return [];
    }
    return contacts;
  },

  async create(input) {
    await delay(400);
    const created: EmergencyContact = {
      id: nextId(),
      name: input.name,
      phone: input.phone,
      relation: input.relation ?? null,
    };
    contacts = [...contacts, created];
    return created;
  },

  async remove(contactId) {
    await delay(300);
    contacts = contacts.filter((c) => c.id !== contactId);
  },
};
