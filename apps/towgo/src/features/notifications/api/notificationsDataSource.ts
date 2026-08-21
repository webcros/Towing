import type {
  NotificationsListResponse,
  NotificationsReadResponse,
  UnreadCountResponse,
} from '@towing/api-contracts';
import { env } from '@/lib/env';
import { notificationsMockSource } from './notificationsMockSource';
import { notificationsRestSource } from './notificationsRestSource';

/** §12's in-app notification centre — the bell in `AppHeader` (Phase 13). */
export interface NotificationsDataSource {
  list(cursor?: string): Promise<NotificationsListResponse>;
  unreadCount(): Promise<UnreadCountResponse>;
  /** No ids means "mark everything read" — one route, matching the backend. */
  markRead(ids?: string[]): Promise<NotificationsReadResponse>;
}

export const notificationsDataSource: NotificationsDataSource = env.useMocks
  ? notificationsMockSource
  : notificationsRestSource;
