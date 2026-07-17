import { env } from '@/lib/env';
import type { BookingsDataSource } from './bookingsDataSource';
import type { Booking } from '../types';
import { bookingsMock } from '../mocks/bookings.mock';

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Mock bookings with realistic latency. `EXPO_PUBLIC_MOCK_BOOKINGS_STATE`
 * forces empty/error so the §10.9 states can be exercised without a backend.
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
};
