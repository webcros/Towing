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
