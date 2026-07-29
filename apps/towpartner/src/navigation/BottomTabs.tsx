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
