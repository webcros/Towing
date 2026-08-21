import { create } from 'zustand';

type DriverStatusStore = {
  /** Whether the driver is accepting new tow requests, as last confirmed by the server. */
  isOnline: boolean;
  /** Written ONLY by `usePresence`, after the server has agreed. */
  setOnline: (online: boolean) => void;
};

/**
 * Online/offline availability, as the UI knows it.
 *
 * A MIRROR OF THE SERVER, NOT THE SOURCE OF TRUTH — that changed in Phase 16.
 * The old header here said "a real build persists it and syncs to the dispatch
 * backend"; it now does. `usePresence` owns the transition (permission prompt →
 * GPS fix → `POST /v1/driver/{online,offline}` → start/stop capture) and writes
 * the result here; nothing else may call `setOnline`, and `toggle` is gone
 * precisely because a local flip is no longer a meaningful operation.
 *
 * NOT PERSISTED, deliberately. §6.1's liveness is ping freshness, so the server
 * drops a driver from the candidate store within a stale window of their last
 * ping regardless of what any handset believes. Restoring `isOnline: true` from
 * disk at launch would show a driver as online when they are in no GEO set —
 * which is the phantom-supply state the whole phase is built to avoid, except
 * pointed at the driver instead of at dispatch.
 *
 * Defaults to `false`: a fully unauthenticated fresh install used to boot with
 * `isOnline: true` and zero gating. The approval gate itself lives in the
 * component layer (`OnlineStatusCard`'s `disabled` prop, driven by
 * `authStore.identity.kycStatus`), not here — see that component's header for
 * why the KYC status is not duplicated into this store either.
 */
export const useDriverStatusStore = create<DriverStatusStore>((set) => ({
  isOnline: false,
  setOnline: (online) => set({ isOnline: online }),
}));
