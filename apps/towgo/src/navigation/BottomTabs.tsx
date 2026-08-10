import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from './types';
import { TabBar } from './TabBar';
import { BookingsStack } from './BookingsStack';
import { HomeScreen } from '@/screens/home/HomeScreen';
import { ServicesScreen } from '@/screens/services/ServicesScreen';
import { ProfileScreen } from '@/screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

/**
 * Tab scenes swap instantly — `animation` is left unset, which is v7's `'none'`.
 *
 * A cross-dissolve was tried and removed. Bottom-tabs keeps every visited scene
 * mounted, so fading one out while fading the next in leaves two (or three)
 * semi-transparent screens stacked for the duration: you could read the Services
 * headings straight through the Bookings list, and the blended whites showed up
 * as a grey wash. That is inherent to dissolving between mounted, non-opaque
 * scenes, not something a different curve or duration fixes.
 *
 * All the motion for a tab change lives in the pill in `TabBar.tsx`, which sits
 * outside the scenes and so can never blend with them.
 */
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
