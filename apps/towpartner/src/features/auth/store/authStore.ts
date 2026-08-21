import { create } from 'zustand';
import type { DriverSession } from '@towing/api-contracts';
import { storage } from '@/lib/storage/storage';
import { stop as stopLocationCapture } from '@/lib/location/driverLocationService';
import { clearLocationState } from '@/lib/location/pingBuffer';
import { disconnectDriverSocket } from '@/lib/realtime/driverSocket';
import type { DriverIdentity } from '../types';

type AuthStatus = 'hydrating' | 'authenticated' | 'unauthenticated';

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  identity: DriverIdentity;
}

const SESSION_KEY = 'auth.session';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  refreshToken: string | null;
  identity: DriverIdentity | null;
  /**
   * True once `/kyc/status` has resolved at least once THIS session —
   * `identity.kycStatus` alone can be a stale value hydrated from MMKV
   * (persisted from a previous session, possibly since revoked server-side).
   * `OnlineStatusCard`'s toggle gates on this in addition to `kycStatus ===
   * 'approved'` so it can't go interactive off an unconfirmed value.
   */
  kycVerified: boolean;
  /** Reads MMKV at boot — call once from the root navigator, before it decides what to render. */
  hydrate: () => Promise<void>;
  setSession: (session: DriverSession) => void;
  /** Refresh-on-401 updates the token pair only — `identity` doesn't change mid-session. */
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  /**
   * The real backend rebuilds `kyc_status` into the access-token claim on
   * every refresh (`KycApprovedGuard`'s own comment); a mobile client that
   * doesn't decode JWTs client-side instead treats `useKycStatus()` — the
   * authoritative `/kyc/status` read — as the source of truth and syncs it
   * here. `RootNavigator`'s gate reads `identity.kycStatus` synchronously
   * rather than depending on a query at the root, so this bridge is what
   * makes "unlocks on refetch" actually unlock the gate.
   */
  setKycStatus: (kycStatus: DriverIdentity['kycStatus']) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'hydrating',
  accessToken: null,
  refreshToken: null,
  identity: null,
  kycVerified: false,

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
      identity: session.driver,
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
    // previous driver even though the UI shows them logged out.
    if (status !== 'authenticated' || !identity) return;
    const stored: StoredSession = { ...tokens, identity };
    storage.set(SESSION_KEY, JSON.stringify(stored));
    set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
  },

  setKycStatus: (kycStatus) => {
    const { identity, accessToken, refreshToken } = get();
    if (!identity) return;
    if (identity.kycStatus === kycStatus) {
      // Still marks this session as having a confirmed read even when the
      // stale persisted value already matched — `kycVerified` gates the
      // online toggle (`OnlineStatusCard`) separately from routing, and must
      // flip true on this no-op path too, or a driver whose status never
      // changes would never pass the gate.
      set({ kycVerified: true });
      return;
    }
    const nextIdentity: DriverIdentity = { ...identity, kycStatus };
    if (accessToken && refreshToken) {
      const stored: StoredSession = { accessToken, refreshToken, identity: nextIdentity };
      storage.set(SESSION_KEY, JSON.stringify(stored));
    }
    set({ identity: nextIdentity, kycVerified: true });
  },

  clearSession: () => {
    storage.delete(SESSION_KEY);
    /**
     * Location capture stops and its buffer is dropped (Phase 16).
     *
     * A buffered fix carries no session binding of its own — it replays under
     * whoever is signed in when connectivity returns. On a shared handset, one
     * driver's trail flushed under the next driver's token would attribute the
     * first driver's movements to the second, in `booking_location_path`, which
     * is trip evidence. The same reasoning `clearQueuedMutations` already
     * applies to the mutation queue.
     *
     * Fire and forget: `stop()` awaits a final flush that will fail (the token
     * is already gone), and a logout must not wait on the network to complete.
     */
    void stopLocationCapture();
    clearLocationState();
    disconnectDriverSocket();

    set({
      status: 'unauthenticated',
      accessToken: null,
      refreshToken: null,
      identity: null,
      kycVerified: false,
    });
  },
}));
