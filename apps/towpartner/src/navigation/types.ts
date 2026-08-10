import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs — the 5-slot driver nav (New Job is the center FAB). */
export type DriverTabParamList = {
  Home: undefined;
  Jobs: undefined;
  NewJob: undefined;
  Earnings: undefined;
  Profile: undefined;
};

/**
 * Root stack. Auth + KYC-gate screens first (see `RootNavigator`'s gating),
 * then Tabs and detail/sub-screens. The screens beyond the five designed tabs
 * are lightweight placeholders (Figma not yet designed).
 */
export type RootStackParamList = {
  /** Shown once at boot while `authStore.hydrate()` reads the persisted session. */
  Splash: undefined;
  // Auth — rendered instead of Tabs while unauthenticated.
  PhoneEntry: undefined;
  Otp: { challengeId: string; mobile: string; resendAfterSeconds: number };

  // §3.1 KYC gate — forced while `identity.kycStatus !== 'approved'`, also
  // reachable from Profile once approved (Documents row).
  KycWizard: undefined;
  KycStatus: undefined;

  Tabs: NavigatorScreenParams<DriverTabParamList> | undefined;

  JobDetails: { jobId: string } | undefined;
  ActiveJob: { offerId: string } | undefined;

  // Account (Profile) sub-screens
  PersonalInformation: undefined;
  /** Vehicle class + long-distance opt-in (`PUT /driver/capabilities`). Was `MyVehicles`. */
  Capabilities: undefined;
  BankDetails: undefined;
  Insurance: undefined;
  HelpSupport: undefined;
  Terms: undefined;
  Privacy: undefined;
  Notifications: undefined;
};
