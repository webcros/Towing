import type { NavigatorScreenParams } from '@react-navigation/native';

/** Nested inside the Bookings tab so the tab bar stays visible on the detail. */
export type BookingsStackParamList = {
  BookingsList: undefined;
  BookingDetails: { bookingId: string };
};

export type RootTabParamList = {
  Home: undefined;
  Bookings: NavigatorScreenParams<BookingsStackParamList> | undefined;
  Services: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  /** Shown once at boot while `authStore.hydrate()` reads the persisted session. */
  Splash: undefined;
  // Auth (spec §9.1.1) — rendered instead of Tabs while unauthenticated.
  PhoneEntry: undefined;
  Otp: { challengeId: string; mobile: string; resendAfterSeconds: number };
  /** Pushed once, only when the just-verified identity has `isNew: true`. */
  ProfileSetup: undefined;

  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  /** Step 1 — enter pickup / drop, schedule, for-whom. */
  BookLocation: undefined;
  /** Step 2 — map + tow-type selection + confirm. */
  BookTow: undefined;
  /** Progressive-radius driver search (spec §9.1.6). */
  Searching: undefined;
  /** Live tracking of the assigned driver (spec §9.1.7). */
  Tracking: undefined;

  // Account sub-screens (spec §9.1.11)
  PersonalInformation: undefined;
  MyVehicles: undefined;
  AddVehicle: { vehicleId?: string } | undefined;
  SavedLocations: undefined;
  AddSavedLocation: { locationId?: string } | undefined;
  PaymentMethods: undefined;
  NotificationsSettings: undefined;
  HelpCenter: undefined;
  ContactUs: undefined;
  Settings: undefined;
  EmergencyContacts: undefined;
  AddEmergencyContact: undefined;
  Legal: undefined;
};
