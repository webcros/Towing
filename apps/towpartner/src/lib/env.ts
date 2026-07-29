/**
 * Typed access to build-time public env. `EXPO_PUBLIC_*` values are statically
 * inlined by Metro, so this file is the single place the app reads them.
 */
type MockState = '' | 'empty' | 'error';

export const env = {
  /** Use the in-app mock data sources instead of the (future) REST backend. */
  useMocks: (process.env.EXPO_PUBLIC_USE_MOCKS ?? 'true') !== 'false',

  /** Dev-only: force a query into a state to preview §10.9 UI. */
  mockDashboardState: (process.env.EXPO_PUBLIC_MOCK_DASHBOARD_STATE ?? '') as MockState,
  mockJobsState: (process.env.EXPO_PUBLIC_MOCK_JOBS_STATE ?? '') as MockState,
  mockEarningsState: (process.env.EXPO_PUBLIC_MOCK_EARNINGS_STATE ?? '') as MockState,
  mockProfileState: (process.env.EXPO_PUBLIC_MOCK_PROFILE_STATE ?? '') as MockState,
  /** Dev-only: force the incoming-offer state ('' | 'none'). */
  mockOfferState: (process.env.EXPO_PUBLIC_MOCK_OFFER_STATE ?? '') as '' | 'none',
};
