import type {
  NotificationsListResponse,
  NotificationsReadResponse,
  UnreadCountResponse,
} from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { NotificationsDataSource } from './notificationsDataSource';

export const notificationsRestSource: NotificationsDataSource = {
  list(cursor) {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return apiFetch<NotificationsListResponse>(`driver/notifications${query}`);
  },

  unreadCount() {
    return apiFetch<UnreadCountResponse>('driver/notifications/unread-count');
  },

  markRead(ids) {
    return apiFetch<NotificationsReadResponse>('driver/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
      idempotent: true,
    });
  },
};
