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
 * Root stack. Tabs first, then detail/sub-screens. The screens beyond the
 * five designed tabs are lightweight placeholders (Figma not yet designed).
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<DriverTabParamList> | undefined;

  JobDetails: { jobId: string } | undefined;
  ActiveJob: { offerId: string } | undefined;

  // Account (Profile) sub-screens
  PersonalInformation: undefined;
  MyVehicles: undefined;
  Documents: undefined;
  BankDetails: undefined;
  Insurance: undefined;
  HelpSupport: undefined;
  Terms: undefined;
  Privacy: undefined;
  Notifications: undefined;
};
