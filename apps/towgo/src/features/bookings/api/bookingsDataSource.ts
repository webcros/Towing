import type { Booking } from '../types';
import { bookingsMockSource } from './bookingsMockSource';

/**
 * Boundary between UI and backend. Mock now; a REST implementation swaps in
 * later (selected by env.useMocks) with no change to query hooks or components.
 */
export interface BookingsDataSource {
  getBookings(): Promise<Booking[]>;
}

export const bookingsDataSource: BookingsDataSource = bookingsMockSource;
