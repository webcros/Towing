import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { DriverTabParamList } from './types';
import { DriverTabBar } from './DriverTabBar';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { JobsScreen } from '@/screens/jobs/JobsScreen';
import { NewJobScreen } from '@/screens/newjob/NewJobScreen';
import { EarningsScreen } from '@/screens/earnings/EarningsScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<DriverTabParamList>();

/**
 * Tab scenes swap instantly — `animation` is left unset, which is v7's 'none'.
 *
 * Do not add a scene animation here. Bottom-tabs keeps every visited scene
 * mounted, so fading one out while fading the next in leaves two or three
 * semi-transparent screens stacked for the duration; the customer app shipped
 * exactly that and it read as a grey wash with two screens legible at once.
 * All the motion for a tab change lives in the bar, which renders outside the
 * scenes and so can never blend with them.
 */
export function BottomTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <DriverTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="NewJob" component={NewJobScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
