import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';

/**
 * One column of an at-a-glance stat row: amber icon badge + label + value.
 * Shared by the booking Request Details card and Booking Details.
 */
export function StatColumn({
  icon: Icon,
  label,
  value,
  tabular,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  tabular?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.colors.brandTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={theme.colors.brand} strokeWidth={2} />
      </View>
      <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Text>
      <Text
        weight="medium"
        tabular={tabular}
        numberOfLines={1}
        align="center"
        style={{ fontSize: 13.5, lineHeight: 18 }}
      >
        {value}
      </Text>
    </View>
  );
}
