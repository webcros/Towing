import type {
  SubjectNotificationPrefs,
  SubjectNotificationPrefsUpdate,
} from '@towing/api-contracts';
import { env } from '@/lib/env';
import { notificationPrefsMockSource } from './notificationPrefsMockSource';
import { notificationPrefsRestSource } from './notificationPrefsRestSource';

/**
 * §12.3 per-user channel opt-outs (Phase 13). Replaces the in-memory
 * `notificationPrefsStore` this app carried until now, whose four booleans
 * reset on every app launch and never reached a server.
 */
export interface NotificationPrefsDataSource {
  get(): Promise<SubjectNotificationPrefs>;
  update(patch: SubjectNotificationPrefsUpdate): Promise<SubjectNotificationPrefs>;
}

export const notificationPrefsDataSource: NotificationPrefsDataSource = env.useMocks
  ? notificationPrefsMockSource
  : notificationPrefsRestSource;
