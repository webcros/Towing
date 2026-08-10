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
  mockDriversState: (process.env.EXPO_PUBLIC_MOCK_DRIVERS_STATE ?? '') as MockState,
  mockBookingsState: (process.env.EXPO_PUBLIC_MOCK_BOOKINGS_STATE ?? '') as MockState,
  /** Dev-only: force the `/me` (profile/vehicles/addresses/emergency-contacts) mocks into empty/error. */
  mockAccountState: (process.env.EXPO_PUBLIC_MOCK_ACCOUNT_STATE ?? '') as MockState,
  /** Dev-only: force the search outcome ('' | 'no_drivers'). */
  mockSearchState: (process.env.EXPO_PUBLIC_MOCK_SEARCH_STATE ?? '') as '' | 'no_drivers',

  /**
   * Google Sign-In is code-complete but flagged off — `GOOGLE_OAUTH_CLIENT_IDS`
   * is still empty server-side (`ToBeDoneEhsan.md` §0ii), so a button that
   * always 403s would be worse than a hidden one.
   */
  googleSignInEnabled: (process.env.EXPO_PUBLIC_GOOGLE_SIGN_IN_ENABLED ?? 'false') === 'true',

  /** Empty by default — analytics falls back to the log adapter until a real GA4 property exists. */
  ga4MeasurementId: process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID ?? '',
  ga4ApiSecret: process.env.EXPO_PUBLIC_GA4_API_SECRET ?? '',
};
