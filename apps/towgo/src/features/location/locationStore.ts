import { create } from 'zustand';
import * as Location from 'expo-location';
import type { LocationStatus, PickupLocation } from './types';

const DEFAULT_PICKUP: PickupLocation = {
  label: 'MG Road, Bengaluru',
  coords: { latitude: 12.9752, longitude: 77.605 },
};

type LocationState = {
  status: LocationStatus;
  pickup: PickupLocation;
  setPickup: (pickup: PickupLocation) => void;
  /** Resolve the device GPS as pickup, subject to the OS permission prompt. */
  useCurrentLocation: () => Promise<void>;
};

export const useLocationStore = create<LocationState>((set) => ({
  status: 'ready',
  pickup: DEFAULT_PICKUP,
  setPickup: (pickup) => set({ pickup }),
  useCurrentLocation: async () => {
    set({ status: 'locating' });

    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      set({ status: 'denied' });
      return;
    }

    try {
      const position = await Location.getCurrentPositionAsync();
      // No reverse-geocode helper exists yet anywhere in the app (that's a
      // later phase's integration, not this one's) — "Current Location" is
      // the label until one does.
      set({
        status: 'ready',
        pickup: {
          label: 'Current Location',
          coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
        },
      });
    } catch {
      set({ status: 'denied' });
    }
  },
}));
