import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Calendar, Clock } from '@/icons';

/**
 * Stacked date over time for the Bookings list card. Booking Details splits the
 * two apart onto its label and address lines, so it composes its own rows.
 */
export function DateTime({
  date,
  time,
  showIcons = true,
  align = 'flex-start',
}: {
  date: string;
  time: string;
  showIcons?: boolean;
  align?: 'flex-start' | 'flex-end';
}) {
  const theme = useTheme();

  return (
    <View accessible accessibilityLabel={`${date} at ${time}`} style={{ gap: 5, alignItems: align }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {showIcons ? <Calendar size={theme.sizes.icon.xs} color={theme.colors.textSecondary} strokeWidth={2} /> : null}
        <Text color="secondary" variant="label" weight="regular">
          {date}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {showIcons ? <Clock size={theme.sizes.icon.xs} color={theme.colors.textSecondary} strokeWidth={2} /> : null}
        <Text color="secondary" variant="label" weight="regular">
          {time}
        </Text>
      </View>
    </View>
  );
}
