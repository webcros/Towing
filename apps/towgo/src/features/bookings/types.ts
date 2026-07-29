import type { ImageSourcePropType } from 'react-native';
import type { TowTypeId } from '@/features/booking/types';

export type BookingStatus = 'completed' | 'cancelled' | 'in_progress' | 'scheduled';

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
 * How the trip was paid for. Booking-local on purpose: the account's
 * `PaymentKind` models saved instruments and has no 'cash'.
 */
export type BookingPaymentMethod = 'cash' | 'card' | 'upi' | 'wallet';

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
