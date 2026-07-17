import type { ImageSourcePropType } from 'react-native';

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
