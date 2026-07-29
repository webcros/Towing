import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Calendar, Clock } from '@/icons';

/**
 * Stacked date over time. Defaults reproduce the Bookings list card exactly;
 * Booking Details opts out of the icons and right-aligns with an emphasised date.
 */
export function DateTime({
  date,
  time,
  showIcons = true,
  align = 'flex-start',
  emphasizeDate = false,
}: {
  date: string;
  time: string;
  showIcons?: boolean;
  align?: 'flex-start' | 'flex-end';
  emphasizeDate?: boolean;
}) {
  const theme = useTheme();
  const size = emphasizeDate ? { fontSize: 12.5, lineHeight: 17 } : { fontSize: 11.5, lineHeight: 15 };

  return (
    <View accessible accessibilityLabel={`${date} at ${time}`} style={{ gap: 3, alignItems: align }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {showIcons ? <Calendar size={12} color={theme.colors.textSecondary} strokeWidth={2} /> : null}
        <Text
          weight={emphasizeDate ? 'medium' : undefined}
          color={emphasizeDate ? 'primary' : 'secondary'}
          style={size}
        >
          {date}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        {showIcons ? <Clock size={12} color={theme.colors.textSecondary} strokeWidth={2} /> : null}
        <Text color="secondary" style={{ fontSize: 11.5, lineHeight: 15 }}>
          {time}
        </Text>
      </View>
    </View>
  );
}
