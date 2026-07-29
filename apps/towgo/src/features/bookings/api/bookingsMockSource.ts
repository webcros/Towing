import { env } from '@/lib/env';
import type { BookingsDataSource } from './bookingsDataSource';
import type { Booking, BookingDetail } from '../types';
import { bookingsMock, bookingDetailsMock } from '../mocks/bookings.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock bookings with realistic latency. `EXPO_PUBLIC_MOCK_BOOKINGS_STATE`
 * forces empty/error so the §10.9 states can be exercised without a backend.
 * For `getBooking`, 'empty' doubles as not-found (there is no separate key).
 */
export const bookingsMockSource: BookingsDataSource = {
  async getBookings(): Promise<Booking[]> {
    await delay(700);
    if (env.mockBookingsState === 'error') {
      throw new Error('Failed to load bookings');
    }
    if (env.mockBookingsState === 'empty') {
      return [];
    }
    return bookingsMock;
  },

  async getBooking(bookingId: string): Promise<BookingDetail | null> {
    // A drill-down should feel snappier than a cold list.
    await delay(450);
    if (env.mockBookingsState === 'error') {
      throw new Error('Failed to load booking');
    }
    if (env.mockBookingsState === 'empty') {
      return null;
    }
    return bookingDetailsMock.find((b) => b.id === bookingId) ?? null;
  },
};
