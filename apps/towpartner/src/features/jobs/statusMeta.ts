import type { IconComponent } from '@towing/ui';
import { Check, X, Truck, Navigation, MapPin, Clock, Search, Receipt, CircleHelp } from '@/icons';
import type { ChipTone } from '@/theme/driverColors';
import type { JobStatus } from './types';

/**
 * Chip glyph + tone + label per job status — the driver-app mirror of TowGo's
 * `features/bookings/statusMeta.ts`. Every one of the contract's ten statuses
 * has an entry: a `Record<JobStatus, …>` makes a missing one a compile error
 * rather than an `undefined` chip at runtime, which is the whole reason the
 * status vocabulary is widened before real job data flows.
 */
export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; tone: ChipTone; icon: IconComponent }
> = {
  searching: { label: 'Searching', tone: 'slate', icon: Search },
  assigned: { label: 'Assigned', tone: 'blue', icon: Truck },
  en_route: { label: 'On the Way', tone: 'blue', icon: Navigation },
  arrived: { label: 'Arrived', tone: 'blue', icon: MapPin },
  in_progress: { label: 'In Progress', tone: 'gold', icon: Clock },
  completed: { label: 'Completed', tone: 'green', icon: Check },
  paid: { label: 'Paid', tone: 'green', icon: Receipt },
  cancelled: { label: 'Cancelled', tone: 'red', icon: X },
  no_drivers_found: { label: 'No Drivers Found', tone: 'red', icon: X },
  disputed: { label: 'Disputed', tone: 'orange', icon: CircleHelp },
};
