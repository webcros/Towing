import type { NotificationDto } from '@towing/api-contracts';

/**
 * Mock inbox rows for the customer bell.
 *
 * Deliberately a mix of read and unread, so the dot, the row's unread
 * treatment and "mark all read" all have something to do without a server.
 *
 * ⚠ Every `event` here is a REAL registry key. A fixture that invented its own
 * would let `handleNotificationData` pass in mock mode and do nothing against
 * the backend — the discriminator is the one thing both halves have to agree
 * on, so the fake has to use the real vocabulary.
 *
 * Only `driver.kyc.approved` is registered today; the other two are §12.2 rows
 * whose emitters arrive in Phases 19 and 15. They are here so the screen has
 * realistic variety, and they are the exact keys those phases will emit.
 */
export const MOCK_NOTIFICATIONS: NotificationDto[] = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    event: 'driver.kyc.approved',
    category: 'transactional',
    title: 'Your driver is verified',
    body: 'Ravi has been verified and is on the way to you.',
    data: {
      event: 'driver.kyc.approved',
      notificationId: '00000000-0000-4000-8000-000000000001',
      action: 'open',
    },
    readAt: null,
    createdAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    event: 'payment.succeeded',
    category: 'money',
    title: 'Payment received',
    body: 'We received ₹1,250 for your tow on 6 August. Your receipt is on its way by email.',
    data: {
      event: 'payment.succeeded',
      notificationId: '00000000-0000-4000-8000-000000000002',
      action: 'open',
    },
    readAt: null,
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    event: 'booking.confirmed',
    category: 'job',
    title: 'Booking confirmed',
    body: 'Your flatbed tow from Indiranagar is confirmed. We are finding you a driver.',
    data: {
      event: 'booking.confirmed',
      notificationId: '00000000-0000-4000-8000-000000000003',
      action: 'open',
    },
    readAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];
