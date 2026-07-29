export const bookingsKeys = {
  all: ['bookings'] as const,
  list: () => ['bookings', 'list'] as const,
  detail: (bookingId: string) => ['bookings', 'detail', bookingId] as const,
};
