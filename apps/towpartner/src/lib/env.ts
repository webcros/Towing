/**
 * Typed access to build-time public env. `EXPO_PUBLIC_*` values are statically
 * inlined by Metro, so this file is the single place the app reads them.
 */
type MockState = '' | 'empty' | 'error';

export const env = {
  /** Use the in-app mock data sources instead of the real REST backend. */
  useMocks: (process.env.EXPO_PUBLIC_USE_MOCKS ?? 'true') !== 'false',

  /**
   * Backend base URL (Phase 12). `localhost` works from an iOS simulator and
   * web; an Android emulator needs `http://10.0.2.2:4000`, a physical device
   * needs the host machine's LAN IP — set `EXPO_PUBLIC_API_URL` per
   * environment, see `.env.example`.
   */
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000',

  /** Dev-only: force a query into a state to preview §10.9 UI. */
  mockDashboardState: (process.env.EXPO_PUBLIC_MOCK_DASHBOARD_STATE ?? '') as MockState,
  mockJobsState: (process.env.EXPO_PUBLIC_MOCK_JOBS_STATE ?? '') as MockState,
  mockEarningsState: (process.env.EXPO_PUBLIC_MOCK_EARNINGS_STATE ?? '') as MockState,
  mockProfileState: (process.env.EXPO_PUBLIC_MOCK_PROFILE_STATE ?? '') as MockState,
  /** Dev-only: force the incoming-offer state ('' | 'none'). */
  mockOfferState: (process.env.EXPO_PUBLIC_MOCK_OFFER_STATE ?? '') as '' | 'none',

  /** Empty by default — analytics falls back to the log adapter until a real GA4 property exists. */
  ga4MeasurementId: process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID ?? '',
  ga4ApiSecret: process.env.EXPO_PUBLIC_GA4_API_SECRET ?? '',
};
