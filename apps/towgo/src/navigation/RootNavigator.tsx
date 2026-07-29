import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '@towing/theme';
import type { RootStackParamList } from './types';
import { BottomTabs } from './BottomTabs';
import { BookLocationScreen } from '@/screens/booking/BookLocationScreen';
import { BookTowScreen } from '@/screens/booking/BookTowScreen';
import { SearchingScreen } from '@/screens/booking/SearchingScreen';
import { TrackingScreen } from '@/screens/booking/TrackingScreen';
import { PersonalInformationScreen } from '@/screens/account/PersonalInformationScreen';
import { MyVehiclesScreen } from '@/screens/account/MyVehiclesScreen';
import { AddVehicleScreen } from '@/screens/account/AddVehicleScreen';
import { SavedLocationsScreen } from '@/screens/account/SavedLocationsScreen';
import { AddSavedLocationScreen } from '@/screens/account/AddSavedLocationScreen';
import { PaymentMethodsScreen } from '@/screens/account/PaymentMethodsScreen';
import { NotificationsSettingsScreen } from '@/screens/account/NotificationsSettingsScreen';
import { HelpCenterScreen } from '@/screens/account/HelpCenterScreen';
import { ContactUsScreen } from '@/screens/account/ContactUsScreen';
import { SettingsScreen } from '@/screens/account/SettingsScreen';
import { navLightTheme, navDarkTheme } from './navTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const theme = useTheme();
  return (
    <NavigationContainer theme={theme.isDark ? navDarkTheme : navLightTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={BottomTabs} />
        <Stack.Screen
          name="BookLocation"
          component={BookLocationScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="BookTow" component={BookTowScreen} />
        <Stack.Screen
          name="Searching"
          component={SearchingScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />
        <Stack.Screen
          name="Tracking"
          component={TrackingScreen}
          options={{ animation: 'fade', gestureEnabled: false }}
        />

        <Stack.Screen name="PersonalInformation" component={PersonalInformationScreen} />
        <Stack.Screen name="MyVehicles" component={MyVehiclesScreen} />
        <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
        <Stack.Screen name="SavedLocations" component={SavedLocationsScreen} />
        <Stack.Screen name="AddSavedLocation" component={AddSavedLocationScreen} />
        <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
        <Stack.Screen name="NotificationsSettings" component={NotificationsSettingsScreen} />
        <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
        <Stack.Screen name="ContactUs" component={ContactUsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
