import type {
  NotificationsListResponse,
  NotificationsReadResponse,
  UnreadCountResponse,
} from '@towing/api-contracts';
import { env } from '@/lib/env';
import { MOCK_NOTIFICATIONS } from '../mocks/notifications.mock';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Module-level mutable state, same shape every other mock source in this app uses. */
let rows = MOCK_NOTIFICATIONS.map((row) => ({ ...row }));

export const notificationsMockSource = {
  async list(): Promise<NotificationsListResponse> {
    await delay(400);
    if (env.mockNotificationsState === 'error') throw new Error('Mock notifications error');
    if (env.mockNotificationsState === 'empty') return { items: [], nextCursor: null };

    // One page: the mock set is small enough that paging it would only test
    // the mock. Cursor paging is covered by the backend suite.
    return { items: rows, nextCursor: null };
  },

  async unreadCount(): Promise<UnreadCountResponse> {
    await delay(200);
    if (env.mockNotificationsState === 'empty') return { unread: 0 };
    return { unread: rows.filter((row) => row.readAt === null).length };
  },

  async markRead(ids?: string[]): Promise<NotificationsReadResponse> {
    await delay(250);
    const now = new Date().toISOString();
    let marked = 0;

    rows = rows.map((row) => {
      const targeted = !ids || ids.includes(row.id);
      if (!targeted || row.readAt !== null) return row;
      marked += 1;
      return { ...row, readAt: now };
    });

    return { markedRead: marked, unread: rows.filter((row) => row.readAt === null).length };
  },
};
