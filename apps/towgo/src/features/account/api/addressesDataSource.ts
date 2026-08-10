import type { SavedAddress, SavedAddressCreate, SavedAddressUpdate } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { addressesMockSource } from './addressesMockSource';
import { addressesRestSource } from './addressesRestSource';

export interface AddressesDataSource {
  list(): Promise<SavedAddress[]>;
  create(input: SavedAddressCreate): Promise<SavedAddress>;
  update(addressId: string, patch: SavedAddressUpdate): Promise<SavedAddress>;
  remove(addressId: string): Promise<void>;
}

export const addressesDataSource: AddressesDataSource = env.useMocks
  ? addressesMockSource
  : addressesRestSource;
