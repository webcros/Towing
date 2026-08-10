import { createMMKV, type MMKV } from 'react-native-mmkv';
import type { KVStorage } from './storage';

/**
 * `KVStorage` over `react-native-mmkv` — the swap `storage.ts`'s own header
 * comment documents. `react-native-mmkv@4` (Nitro Modules) exports `MMKV`
 * only as a type — the constructor is the free function `createMMKV()` — and
 * renamed `delete` to `remove`; both are v4-specific, not this class's own API.
 */
export class MmkvStorage implements KVStorage {
  private readonly mmkv: MMKV = createMMKV();

  getString(key: string): string | undefined {
    return this.mmkv.getString(key);
  }
  set(key: string, value: string): void {
    this.mmkv.set(key, value);
  }
  delete(key: string): void {
    this.mmkv.remove(key);
  }
}
