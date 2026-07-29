import { useQuery } from '@tanstack/react-query';
import { bookingsDataSource } from './bookingsDataSource';
import { bookingsKeys } from './bookings.keys';

/** Past bookings / trip history (spec §9.1.10). */
export function useBookings() {
  return useQuery({
    queryKey: bookingsKeys.list(),
    queryFn: () => bookingsDataSource.getBookings(),
  });
}

/**
 * One booking's full detail. `data === null` means not found — deliberately not
 * seeded from the list cache, since a `Booking` is not a `BookingDetail`.
 */
export function useBooking(bookingId: string) {
  return useQuery({
    queryKey: bookingsKeys.detail(bookingId),
    queryFn: () => bookingsDataSource.getBooking(bookingId),
  });
}
