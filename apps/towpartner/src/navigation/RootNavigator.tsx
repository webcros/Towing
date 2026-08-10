import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme, motion } from '@towing/theme';
import type { RootStackParamList } from './types';
import { BottomTabs } from './BottomTabs';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useKycStatus } from '@/features/kyc/api/kyc.queries';
import { SplashScreen } from '@/screens/auth/SplashScreen';
import { PhoneEntryScreen } from '@/screens/auth/PhoneEntryScreen';
import { OtpScreen } from '@/screens/auth/OtpScreen';
import { KycWizardScreen } from '@/screens/kyc/KycWizardScreen';
import { KycStatusScreen } from '@/screens/kyc/KycStatusScreen';
import { CapabilitiesScreen } from '@/screens/capabilities/CapabilitiesScreen';
import { PlaceholderScreen } from '@/screens/placeholder/PlaceholderScreen';
import { navLightTheme, navDarkTheme } from './navTheme';
import { track } from '@/lib/analytics/analytics';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Module-scope wrappers so each placeholder route has a stable component identity.
const JobDetailsScreen = () => <PlaceholderScreen title="Job Details" />;
const ActiveJobScreen = () => <PlaceholderScreen title="Active Job" />;
const PersonalInformationScreen = () => <PlaceholderScreen title="Personal Information" />;
const BankDetailsScreen = () => <PlaceholderScreen title="Bank Details" />;
const InsuranceScreen = () => <PlaceholderScreen title="Insurance" />;
const HelpSupportScreen = () => <PlaceholderScreen title="Help & Support" />;
const TermsScreen = () => <PlaceholderScreen title="Terms & Conditions" />;
const PrivacyScreen = () => <PlaceholderScreen title="Privacy Policy" />;
const NotificationsScreen = () => <PlaceholderScreen title="Notifications" />;

export function RootNavigator() {
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);
  const kycStatus = useAuthStore((s) => s.identity?.kycStatus);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
    track('app_open');
  }, [hydrate]);

  // Keeps `authStore.identity.kycStatus` (the gate's source of truth, read
  // synchronously below) fresh off the authoritative `/kyc/status` endpoint —
  // see `useKycStatus`'s own comment for why this lives there and not here.
  // `enabled` guards against firing before a session/token exists.
  useKycStatus({ enabled: status === 'authenticated' });

  const approved = kycStatus === 'approved';

  // Decided once per branch-change, not re-evaluated on every kycStatus
  // tick while the KYC screens are already mounted — see this file's own
  // history for why (KycWizardScreen navigates to KycStatus imperatively on
  // submit, KycStatusScreen navigates back to KycWizard imperatively too).
  const initialRouteName: keyof RootStackParamList =
    status === 'hydrating'
      ? 'Splash'
      : status === 'unauthenticated'
        ? 'PhoneEntry'
        : !approved
          ? kycStatus === 'incomplete'
            ? 'KycWizard'
            : 'KycStatus'
          : 'Tabs';

  return (
    <NavigationContainer theme={theme.isDark ? navDarkTheme : navLightTheme}>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={{
          headerShown: false,
          // The account sub-screens inherit this. They previously took the
          // native 'default', which on Android is a Material fade-through and
          // reads flat; ios_from_right parallaxes the outgoing screen under a
          // dimming overlay, so pushing into a detail feels hierarchical.
          animation: 'ios_from_right',
          // Paints the gap during an Android push, which otherwise flashes the
          // window background between screens.
          contentStyle: { backgroundColor: theme.colors.surface0 },
        }}
      >
        {status === 'hydrating' ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : status === 'unauthenticated' ? (
          <>
            <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
            <Stack.Screen name="Otp" component={OtpScreen} />
          </>
        ) : !approved ? (
          <>
            <Stack.Screen name="KycWizard" component={KycWizardScreen} />
            <Stack.Screen name="KycStatus" component={KycStatusScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Tabs" component={BottomTabs} />

            <Stack.Screen name="JobDetails" component={JobDetailsScreen} />
            <Stack.Screen
              name="ActiveJob"
              component={ActiveJobScreen}
              // gestureDirection: 'vertical' also turns on fullScreenGestureEnabled
              // and animationMatchesGesture on iOS, so the swipe-down that dismisses
              // this mirrors the slide that opened it.
              options={{
                animation: 'slide_from_bottom',
                gestureDirection: 'vertical',
                animationDuration: motion.duration.slow,
              }}
            />

            <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
            <Stack.Screen name="Capabilities" component={CapabilitiesScreen} />
            {/* Also reachable here (not just the gate above) so an approved
                driver can revisit their documents/status from Profile. */}
            <Stack.Screen name="KycWizard" component={KycWizardScreen} />
            <Stack.Screen name="KycStatus" component={KycStatusScreen} />
            <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
            <Stack.Screen name="Insurance" component={InsuranceScreen} />
            <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
            <Stack.Screen name="Terms" component={TermsScreen} />
            <Stack.Screen name="Privacy" component={PrivacyScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
