import { create } from 'zustand';
import type { LocationStatus, PickupLocation } from './types';

const DEFAULT_PICKUP: PickupLocation = {
  label: 'MG Road, Bengaluru',
  coords: { latitude: 12.9752, longitude: 77.605 },
};

type LocationState = {
  status: LocationStatus;
  pickup: PickupLocation;
  setPickup: (pickup: PickupLocation) => void;
  /** Resolve the device GPS as pickup. Stubbed until expo-location is wired. */
  useCurrentLocation: () => Promise<void>;
};

export const useLocationStore = create<LocationState>((set) => ({
  status: 'ready',
  pickup: DEFAULT_PICKUP,
  setPickup: (pickup) => set({ pickup }),
  useCurrentLocation: async () => {
    set({ status: 'locating' });
    await new Promise<void>((resolve) => setTimeout(resolve, 800));
    set({ status: 'ready', pickup: DEFAULT_PICKUP });
  },
}));
