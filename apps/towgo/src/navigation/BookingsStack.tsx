import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { BookingsStackParamList } from './types';
import { BookingsScreen } from '@/screens/bookings/BookingsScreen';
import { BookingDetailsScreen } from '@/screens/bookings/BookingDetailsScreen';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

/** Lives inside the Bookings tab, so pushing a detail keeps the tab bar visible. */
export function BookingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingsList" component={BookingsScreen} />
      <Stack.Screen name="BookingDetails" component={BookingDetailsScreen} />
    </Stack.Navigator>
  );
}
