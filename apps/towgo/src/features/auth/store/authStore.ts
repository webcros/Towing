import { create } from 'zustand';
import type { CustomerSession } from '@towing/api-contracts';
import { storage } from '@/lib/storage/storage';
import type { CustomerIdentity } from '../types';

type AuthStatus = 'hydrating' | 'authenticated' | 'unauthenticated';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  identity: CustomerIdentity;
}

const SESSION_KEY = 'auth.session';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  identity: CustomerIdentity | null;
  /** Reads MMKV at boot — call once from the root navigator, before it decides what to render. */
  hydrate: () => Promise<void>;
  setSession: (session: CustomerSession) => void;
  /** Refresh-on-401 updates the token pair only — `identity` doesn't change mid-session. */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  /**
   * Patches `identity` only, reading the current tokens from the store itself
   * rather than accepting them as params — a caller that closed over
   * `accessToken`/`refreshToken` from an earlier render (e.g. before an
   * `apiFetch` call silently rotated them via a 401 refresh) must never be
   * able to write those stale values back over a fresher pair.
   */
  updateIdentity: (patch: Partial<CustomerIdentity>) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'hydrating',
  accessToken: null,
  refreshToken: null,
  identity: null,

  hydrate: async () => {
    const raw = storage.getString(SESSION_KEY);
    if (!raw) {
      set({ status: 'unauthenticated' });
      return;
    }
    try {
      const stored = JSON.parse(raw) as StoredSession;
      set({
        status: 'authenticated',
        accessToken: stored.accessToken,
        refreshToken: stored.refreshToken,
        identity: stored.identity,
      });
    } catch {
      storage.delete(SESSION_KEY);
      set({ status: 'unauthenticated' });
    }
  },

  setSession: (session) => {
    const stored: StoredSession = {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      identity: session.customer,
    };
    storage.set(SESSION_KEY, JSON.stringify(stored));
    set({
      status: 'authenticated',
      accessToken: stored.accessToken,
      refreshToken: stored.refreshToken,
      identity: stored.identity,
    });
  },

  setTokens: (tokens) => {
    const { status, identity } = get();
    // A refresh that resolves after logout must not resurrect a session —
    // without this guard a stray, still-valid token pair lands back in
    // memory (and would keep landing there) with `status` stuck
    // 'unauthenticated', so a subsequent call could silently act as the
    // previous user even though the UI shows them logged out.
    if (status !== 'authenticated' || !identity) return;
    const stored: StoredSession = { ...tokens, identity };
    storage.set(SESSION_KEY, JSON.stringify(stored));
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  updateIdentity: (patch) => {
    const { identity, accessToken, refreshToken } = get();
    if (!identity) return;
    const nextIdentity: CustomerIdentity = { ...identity, ...patch };
    if (accessToken && refreshToken) {
      const stored: StoredSession = { accessToken, refreshToken, identity: nextIdentity };
      storage.set(SESSION_KEY, JSON.stringify(stored));
    }
    set({ identity: nextIdentity });
  },

  clearSession: () => {
    storage.delete(SESSION_KEY);
    set({ status: 'unauthenticated', accessToken: null, refreshToken: null, identity: null });
  },
}));
