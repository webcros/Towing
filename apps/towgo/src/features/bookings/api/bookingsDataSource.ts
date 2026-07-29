import type { Booking, BookingDetail } from '../types';
import { bookingsMockSource } from './bookingsMockSource';

/**
 * Boundary between UI and backend. Mock now; a REST implementation swaps in
 * later (selected by env.useMocks) with no change to query hooks or components.
 */
export interface BookingsDataSource {
  getBookings(): Promise<Booking[]>;
  /** `null` means no such booking (REST 404). A thrown error means the request failed. */
  getBooking(bookingId: string): Promise<BookingDetail | null>;
}

export const bookingsDataSource: BookingsDataSource = bookingsMockSource;
