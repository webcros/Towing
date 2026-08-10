import type { ImageSourcePropType } from 'react-native';
import type { TowTypeId } from '@/features/booking/types';

/**
 * `'scheduled'` is local-only — a booking not yet handed to the search
 * pipeline — layered on top of the backend's full `jobStatusSchema` (spec
 * §5.1, `packages/api-contracts/src/fleet/jobs.ts`), which this app must be
 * able to render every value of once bookings are backend-integrated (a
 * later phase; `bookingsDataSource` is still mock-only as of Phase 12).
 */
export type BookingStatus =
  | 'scheduled'
  | 'searching'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'no_drivers_found'
  | 'disputed';

/** Origin-dot accent — maps to a theme color in the card. */
export type RouteTone = 'success' | 'info';

export type Booking = {
  id: string;
  originLabel: string;
  destinationLabel: string;
  date: string;
  time: string;
  status: BookingStatus;
  fare: number;
  routeTone: RouteTone;
  vehiclePlate: string;
  driverName: string;
  driverRating: number;
  truckImage: ImageSourcePropType;
};

/**
 * How the trip was paid for. Booking-local on purpose, distinct from the
 * account's `PaymentKind` (saved instruments). Cash is not a supported
 * payment method (confirmed spec correction, Phase 12) — every booking is
 * paid through a saved instrument.
 */
export type BookingPaymentMethod = 'card' | 'upi' | 'wallet';

/**
 * Detail payload — what `GET /bookings/:id` returns: every list field plus the
 * fields only the details screen renders. `GET /bookings` keeps returning `Booking`.
 */
export type BookingDetail = Booking & {
  /** Human-readable reference under the screen title, e.g. "TG1705241030". */
  reference: string;
  /** Enum, not a label — "Light Duty" / "Light Duty Tow Truck" are derived. */
  towTypeId: TowTypeId;
  /** 45 -> formatEta(45) === "45 mins". */
  durationMinutes: number;
  /** 8.6 -> "8.6 km". */
  distanceKm: number;
  paymentMethod: BookingPaymentMethod;
  driverPhoto: ImageSourcePropType;
  /** Lifetime completed trips, shown as "(128 trips)". */
  driverTrips: number;
};
