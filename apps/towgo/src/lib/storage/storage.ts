/**
 * Key–value storage behind a small interface so the app boots in Expo Go today
 * (in-memory) and can switch to MMKV in a dev/prod build with a one-line change
 * — without touching callers.
 *
 * To enable MMKV later: `npx expo install react-native-mmkv`, add a
 * `mmkv.ts` that implements KVStorage over `new MMKV()`, then point `storage`
 * at it inside a try/catch (MMKV throws in Expo Go, so fall back to memory).
 */
export interface KVStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  delete(key: string): void;
}

class MemoryStorage implements KVStorage {
  private readonly map = new Map<string, string>();

  getString(key: string): string | undefined {
    return this.map.get(key);
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

export const storage: KVStorage = new MemoryStorage();
