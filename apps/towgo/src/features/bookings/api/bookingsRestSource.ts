import type { BookingCancelResponse, BookingCreate, BookingOtpResponse } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import { ApiClientError } from '@/lib/api/errors';
import type { BookingDetail } from '../types';
import type { BookingsDataSource, BookingsPage } from './bookingsDataSource';

export const bookingsRestSource: BookingsDataSource = {
  getBookings: (cursor?: string): Promise<BookingsPage> =>
    apiFetch<BookingsPage>(`bookings${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`),

  /**
   * A 404 is "no such booking", not a failure — the interface says so, and the
   * detail screen renders an empty state rather than an error for it. Anything
   * else propagates.
   */
  async getBooking(bookingId: string): Promise<BookingDetail | null> {
    try {
      return await apiFetch<BookingDetail>(`bookings/${bookingId}`);
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 404) return null;
      throw error;
    }
  },

  createBooking: (input: BookingCreate, idempotencyKey: string): Promise<BookingDetail> =>
    apiFetch<BookingDetail>('bookings', {
      method: 'POST',
      body: JSON.stringify(input),
      // The key is passed EXPLICITLY rather than via `idempotent: true`, because
      // it must survive a retry: a caller-supplied header is the one thing
      // `mintIdempotencyKey` will not replace. §19.4 requires a replay to reuse
      // the original key, and a fresh one per attempt would create a second
      // fare-locked booking.
      headers: { 'Idempotency-Key': idempotencyKey },
    }),

  cancelBooking: (bookingId: string, reason?: string): Promise<BookingCancelResponse> =>
    apiFetch<BookingCancelResponse>(`bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify(reason ? { reason } : {}),
      idempotent: true,
    }),

  getOtp: (bookingId: string): Promise<BookingOtpResponse> =>
    apiFetch<BookingOtpResponse>(`bookings/${bookingId}/otp`),

  retrySearch: (bookingId: string): Promise<BookingDetail> =>
    apiFetch<BookingDetail>(`bookings/${bookingId}/retry-search`, {
      method: 'POST',
      // A retry is a fresh intent each time the customer taps it, not a replay —
      // so `idempotent: true` mints a new key per attempt rather than replaying
      // the previous search's response.
      idempotent: true,
    }),
};
