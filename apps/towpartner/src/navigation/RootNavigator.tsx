import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import type { RootStackParamList } from './types';
import { BottomTabs } from './BottomTabs';
import { PlaceholderScreen } from '@/screens/placeholder/PlaceholderScreen';
import { navLightTheme, navDarkTheme } from './navTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Module-scope wrappers so each placeholder route has a stable component identity.
const JobDetailsScreen = () => <PlaceholderScreen title="Job Details" />;
const ActiveJobScreen = () => <PlaceholderScreen title="Active Job" />;
const PersonalInformationScreen = () => <PlaceholderScreen title="Personal Information" />;
const MyVehiclesScreen = () => <PlaceholderScreen title="My Vehicles" />;
const DocumentsScreen = () => <PlaceholderScreen title="Documents" />;
const BankDetailsScreen = () => <PlaceholderScreen title="Bank Details" />;
const InsuranceScreen = () => <PlaceholderScreen title="Insurance" />;
const HelpSupportScreen = () => <PlaceholderScreen title="Help & Support" />;
const TermsScreen = () => <PlaceholderScreen title="Terms & Conditions" />;
const PrivacyScreen = () => <PlaceholderScreen title="Privacy Policy" />;
const NotificationsScreen = () => <PlaceholderScreen title="Notifications" />;

export function RootNavigator() {
  const theme = useTheme();
  return (
    <NavigationContainer theme={theme.isDark ? navDarkTheme : navLightTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={BottomTabs} />

        <Stack.Screen name="JobDetails" component={JobDetailsScreen} />
        <Stack.Screen
          name="ActiveJob"
          component={ActiveJobScreen}
          options={{ animation: 'slide_from_bottom' }}
        />

        <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
        <Stack.Screen name="MyVehicles" component={MyVehiclesScreen} />
        <Stack.Screen name="Documents" component={DocumentsScreen} />
        <Stack.Screen name="BankDetails" component={BankDetailsScreen} />
        <Stack.Screen name="Insurance" component={InsuranceScreen} />
        <Stack.Screen name="HelpSupport" component={HelpSupportScreen} />
        <Stack.Screen name="Terms" component={TermsScreen} />
        <Stack.Screen name="Privacy" component={PrivacyScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
