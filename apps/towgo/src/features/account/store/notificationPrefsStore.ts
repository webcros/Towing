import { create } from 'zustand';
import type { NotificationPrefKey } from '../types';

type NotificationPrefsState = {
  prefs: Record<NotificationPrefKey, boolean>;
  toggle: (key: NotificationPrefKey) => void;
};

export const useNotificationPrefsStore = create<NotificationPrefsState>((set) => ({
  prefs: { bookingUpdates: true, driverArrival: true, promotions: false, receipts: true },
  toggle: (key) => set((s) => ({ prefs: { ...s.prefs, [key]: !s.prefs[key] } })),
}));
