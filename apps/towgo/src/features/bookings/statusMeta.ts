import type { StatusTone } from '@towing/ui';
import type { BookingStatus } from './types';

/** Pill label + tone per booking status — shared by the list card and details. */
export const STATUS_META: Record<BookingStatus, { label: string; tone: StatusTone }> = {
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'error' },
  in_progress: { label: 'In progress', tone: 'info' },
  scheduled: { label: 'Scheduled', tone: 'info' },
};

/** Closing note shown at the foot of the Booking Details summary card. */
export const STATUS_NOTE: Record<BookingStatus, string> = {
  completed: 'This booking is completed. Thank you for choosing TowGo!',
  cancelled: 'This booking was cancelled. You were not charged.',
  in_progress: 'This booking is in progress. Track your driver for live updates.',
  scheduled: 'This booking is scheduled. We’ll assign a driver closer to the time.',
};
