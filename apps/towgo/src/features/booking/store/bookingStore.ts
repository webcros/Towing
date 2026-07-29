import { create } from 'zustand';
import { useLocationStore } from '@/features/location/locationStore';
import type { TowTypeId } from '../types';

export type ScheduleMode = 'now' | 'later';
export type BookingFor = 'me' | 'other';

type BookingState = {
  pickupAddress: string;
  dropAddress: string;
  towTypeId: TowTypeId;
  scheduleMode: ScheduleMode;
  bookingFor: BookingFor;
  note: string;
  setPickupAddress: (value: string) => void;
  setDropAddress: (value: string) => void;
  swapAddresses: () => void;
  setTowType: (id: TowTypeId) => void;
  setScheduleMode: (mode: ScheduleMode) => void;
  toggleBookingFor: () => void;
  setNote: (value: string) => void;
  /** Re-seed the pickup field from the device/location store. */
  seedFromLocation: () => void;
};

export const useBookingStore = create<BookingState>((set, get) => ({
  pickupAddress: useLocationStore.getState().pickup.label,
  dropAddress: '',
  towTypeId: 'light',
  scheduleMode: 'now',
  bookingFor: 'me',
  note: '',
  setPickupAddress: (value) => set({ pickupAddress: value }),
  setDropAddress: (value) => set({ dropAddress: value }),
  swapAddresses: () =>
    set({ pickupAddress: get().dropAddress, dropAddress: get().pickupAddress }),
  setTowType: (id) => set({ towTypeId: id }),
  setScheduleMode: (mode) => set({ scheduleMode: mode }),
  toggleBookingFor: () => set({ bookingFor: get().bookingFor === 'me' ? 'other' : 'me' }),
  setNote: (value) => set({ note: value }),
  seedFromLocation: () => {
    if (!get().pickupAddress) {
      set({ pickupAddress: useLocationStore.getState().pickup.label });
    }
  },
}));
