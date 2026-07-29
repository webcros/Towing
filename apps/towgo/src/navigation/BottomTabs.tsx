import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from './types';
import { TabBar } from './TabBar';
import { BookingsStack } from './BookingsStack';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ServicesScreen } from '@/screens/services/ServicesScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

export function BottomTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      {/* popToTopOnBlur so leaving the tab returns you to the list, not a stale detail. */}
      <Tab.Screen name="Bookings" component={BookingsStack} options={{ popToTopOnBlur: true }} />
      <Tab.Screen name="Services" component={ServicesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
