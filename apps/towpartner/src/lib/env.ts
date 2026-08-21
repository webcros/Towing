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
  /** Dev-only: force the notification centre's mocks into empty/error. */
  mockNotificationsState: (process.env.EXPO_PUBLIC_MOCK_NOTIFICATIONS_STATE ?? '') as MockState,

  ga4MeasurementId: process.env.EXPO_PUBLIC_GA4_MEASUREMENT_ID ?? '',
  ga4ApiSecret: process.env.EXPO_PUBLIC_GA4_API_SECRET ?? '',

  /**
   * Google Maps SDK key for ANDROID (Phase 16).
   *
   * The driver app renders no map of its own yet — Phase 18's job execution is
   * the first screen that needs one — but `react-native-maps` is installed here
   * in the same native rebuild that brings `expo-location` and
   * `expo-task-manager`, so the shared `<MapPreview />` resolves in both apps.
   * Empty (the default) keeps the themed placeholder on Android; iOS renders
   * through Apple Maps with no key. SETUP-CHECKLIST item 7.
   */
  mapsAndroidKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '',

  /**
   * Open a `/driver` WebSocket alongside REST ingress (Phase 16).
   *
   * ON BY DEFAULT and worth a switch anyway: it is the §19.2 kill switch's
   * client half. The server has `REALTIME_ENABLED` and answers the ticket route
   * with a specific 503 when it is off, but a handset burning battery on a
   * reconnect loop during an incident is a problem the operator cannot reach
   * from the server side. REST ingress is unaffected either way — the socket is
   * the fast path, never the only one.
   */
  driverSocketEnabled: (process.env.EXPO_PUBLIC_DRIVER_SOCKET_ENABLED ?? 'true') !== 'false',
};
