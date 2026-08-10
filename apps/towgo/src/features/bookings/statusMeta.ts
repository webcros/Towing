import type { IconComponent, StatusTone } from '@towing/ui';
import { CircleCheck, CircleX, Clock, CalendarClock, Search, Truck, Navigation, MapPin, Receipt, X, CircleHelp } from '@/icons';
import type { BookingStatus } from './types';

/**
 * Pill label + tone per booking status — shared by the list card and details.
 * `icon` is only rendered by the details card's pill; the list card reads
 * `label`/`tone` and ignores it.
 */
export const STATUS_META: Record<
  BookingStatus,
  { label: string; tone: StatusTone; icon: IconComponent }
> = {
  scheduled: { label: 'Scheduled', tone: 'info', icon: CalendarClock },
  searching: { label: 'Searching', tone: 'info', icon: Search },
  assigned: { label: 'Driver Assigned', tone: 'info', icon: Truck },
  en_route: { label: 'On the Way', tone: 'info', icon: Navigation },
  arrived: { label: 'Driver Arrived', tone: 'info', icon: MapPin },
  in_progress: { label: 'In progress', tone: 'info', icon: Clock },
  completed: { label: 'Completed', tone: 'success', icon: CircleCheck },
  paid: { label: 'Paid', tone: 'success', icon: Receipt },
  cancelled: { label: 'Cancelled', tone: 'error', icon: CircleX },
  no_drivers_found: { label: 'No Drivers Found', tone: 'error', icon: X },
  disputed: { label: 'Disputed', tone: 'warning', icon: CircleHelp },
};
