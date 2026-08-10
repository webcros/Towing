import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { MapPin } from '@/icons';
import type { RouteTone } from '../types';

/** Origin dot → dashed connector → destination pin. Used by the Bookings list card.
 *  Booking Details draws its own per-row markers in `RouteRows`. */
export function RouteTimeline({ tone }: { tone: RouteTone }) {
  const theme = useTheme();
  const dotColor = tone === 'success' ? theme.colors.success : theme.colors.info;

  return (
    <View style={{ width: 18, alignItems: 'center', paddingTop: 4, alignSelf: 'stretch' }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: dotColor }} />
      <View
        style={{
          flex: 1,
          minHeight: 32,
          borderLeftWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.borderStrong,
          marginVertical: 6,
        }}
      />
      <MapPin size={16} color={theme.colors.error} fill={theme.colors.error} />
    </View>
  );
}
