import { create } from 'zustand';

type DriverStatusStore = {
  /** Whether the driver is accepting new tow requests. */
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  toggle: () => void;
};

/**
 * Online/offline availability — the driver's most important piece of local
 * state. Drives the dashboard hero and gates incoming job offers. In-memory for
 * now; a real build persists it and syncs to the dispatch backend.
 *
 * Defaults to `false`: a fully unauthenticated fresh install used to boot
 * with `isOnline: true` and zero gating — this store has no idea whether the
 * driver is even signed in, let alone KYC-approved, so "online" must never be
 * the assumed starting state. The actual approval gate lives in the
 * component layer (`OnlineStatusCard`'s `disabled` prop, driven by
 * `authStore.identity.kycStatus`), not here — see that component's header
 * comment for why the KYC status isn't duplicated into this store too.
 */
export const useDriverStatusStore = create<DriverStatusStore>((set) => ({
  isOnline: false,
  setOnline: (online) => set({ isOnline: online }),
  toggle: () => set((s) => ({ isOnline: !s.isOnline })),
}));
