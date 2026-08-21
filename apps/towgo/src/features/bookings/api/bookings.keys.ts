export const bookingsKeys = {
  all: ['bookings'] as const,
  list: () => ['bookings', 'list'] as const,
  detail: (bookingId: string) => ['bookings', 'detail', bookingId] as const,
  otp: (bookingId: string) => ['bookings', 'otp', bookingId] as const,
};
