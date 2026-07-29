/**
 * Typed access to build-time public env. `EXPO_PUBLIC_*` values are statically
 * inlined by Metro, so this file is the single place the app reads them.
 */
type MockState = '' | 'empty' | 'error';

export const env = {
  /** Use the in-app mock data sources instead of the (future) REST backend. */
  useMocks: (process.env.EXPO_PUBLIC_USE_MOCKS ?? 'true') !== 'false',

  /** Dev-only: force a query into a state to preview §10.9 UI. */
  mockDriversState: (process.env.EXPO_PUBLIC_MOCK_DRIVERS_STATE ?? '') as MockState,
  mockBookingsState: (process.env.EXPO_PUBLIC_MOCK_BOOKINGS_STATE ?? '') as MockState,
  /** Dev-only: force the search outcome ('' | 'no_drivers'). */
  mockSearchState: (process.env.EXPO_PUBLIC_MOCK_SEARCH_STATE ?? '') as '' | 'no_drivers',
};
