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
 */
export const useDriverStatusStore = create<DriverStatusStore>((set) => ({
  isOnline: true,
  setOnline: (online) => set({ isOnline: online }),
  toggle: () => set((s) => ({ isOnline: !s.isOnline })),
}));
