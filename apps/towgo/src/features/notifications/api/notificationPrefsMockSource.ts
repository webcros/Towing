import {
  SUBJECT_NOTIFICATION_PREF_DEFAULTS,
  type SubjectNotificationPrefs,
} from '@towing/api-contracts';
import type { NotificationPrefsDataSource } from './notificationPrefsDataSource';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let prefs: SubjectNotificationPrefs = { ...SUBJECT_NOTIFICATION_PREF_DEFAULTS };

export const notificationPrefsMockSource: NotificationPrefsDataSource = {
  async get() {
    await delay(250);
    return { ...prefs };
  },

  async update(patch) {
    await delay(300);
    // Merge, mirroring the server — a mock that replaced would hide the exact
    // bug the real contract was fixed for.
    prefs = { ...prefs, ...patch };
    return { ...prefs };
  },
};
