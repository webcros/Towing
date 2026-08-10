import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { storage } from './storage';

/**
 * TanStack Query persister over the app's `KVStorage` — the seam
 * `queryClient.ts`'s own comment ("MMKV persistence can be layered on later")
 * names. `createAsyncStoragePersister` wants an `AsyncStorage`-shaped API
 * (`getItem`/`setItem`/`removeItem` returning promises); `KVStorage` is
 * synchronous, so this is a thin async wrapper, not a second storage engine.
 */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: async (key: string) => storage.getString(key) ?? null,
    setItem: async (key: string, value: string) => storage.set(key, value),
    removeItem: async (key: string) => storage.delete(key),
  },
  key: 'towpartner-query-cache',
});
