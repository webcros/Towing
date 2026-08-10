import type { SavedAddress } from '@towing/api-contracts';
import { env } from '@/lib/env';
import type { AddressesDataSource } from './addressesDataSource';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let idCounter = 100;
const nextId = () => `mock-address-${(idCounter += 1)}`;

let addresses: SavedAddress[] = [
  {
    id: 'l1',
    label: 'Home',
    fullAddress: 'MG Road, Bengaluru, Karnataka',
    lat: 12.9752,
    lng: 77.605,
    isDefault: true,
  },
  {
    id: 'l2',
    label: 'Work',
    fullAddress: 'Koramangala, Bengaluru, Karnataka',
    lat: 12.9352,
    lng: 77.6146,
    isDefault: false,
  },
];

export const addressesMockSource: AddressesDataSource = {
  async list() {
    await delay(500);
    if (env.mockAccountState === 'error') {
      throw new Error('Failed to load saved locations');
    }
    if (env.mockAccountState === 'empty') {
      return [];
    }
    return addresses;
  },

  async create(input) {
    await delay(400);
    const created: SavedAddress = {
      id: nextId(),
      label: input.label ?? null,
      fullAddress: input.fullAddress,
      lat: input.lat,
      lng: input.lng,
      isDefault: input.isDefault ?? false,
    };
    addresses = [...addresses, created];
    return created;
  },

  async update(addressId, patch) {
    await delay(400);
    const existing = addresses.find((a) => a.id === addressId);
    if (!existing) throw new Error('Saved location not found');
    const updated: SavedAddress = { ...existing, ...patch };
    addresses = addresses.map((a) => (a.id === addressId ? updated : a));
    return updated;
  },

  async remove(addressId) {
    await delay(300);
    addresses = addresses.filter((a) => a.id !== addressId);
  },
};
