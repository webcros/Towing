import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';

/**
 * One column of an at-a-glance stat row: amber icon badge + label + value.
 * Shared by the booking Request Details card (`md`) and Booking Details (`lg`).
 */
export function StatColumn({
  icon: Icon,
  label,
  value,
  tabular,
  size = 'md',
}: {
  icon: IconComponent;
  label: string;
  value: string;
  tabular?: boolean;
  size?: 'md' | 'lg';
}) {
  const theme = useTheme();
  const lg = size === 'lg';
  // The design system's circle family (Figma 40/44/48). The old 56 filled half a
  // stat column, which is what read as oversized. theme.sizes is viewport-scaled.
  const chip = lg ? theme.sizes.circle.lg : theme.sizes.circle.md;

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      // 4, not 8: the Figma stat column is 88 tall total (44 circle + 4 + 16 label
      // + 4 + 20 value). At 8 it ran to 96 and the row dominated the card.
      style={{ flex: 1, alignItems: 'center', gap: theme.spacing.xs, paddingHorizontal: 4 }}
    >
      <View
        style={{
          width: chip,
          height: chip,
          borderRadius: chip / 2,
          backgroundColor: theme.colors.brandTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          size={lg ? theme.sizes.icon.lg - 2 : theme.sizes.icon.md}
          color={theme.colors.brand}
          strokeWidth={2}
        />
      </View>
      <Text variant="label" weight="regular" color="secondary" numberOfLines={1}>
        {label}
      </Text>
      {/*
        `lg` wraps to two lines: even at 14pt bold "Medium Duty" measures wider than
        the ~85pt column a 360pt screen gives it, so a single line would ellipsise
        for two of the four tow types.
      */}
      <Text
        variant={lg ? 'body' : 'caption'}
        weight={lg ? 'bold' : 'medium'}
        tabular={tabular}
        numberOfLines={lg ? 2 : 1}
        align="center"
      >
        {value}
      </Text>
    </View>
  );
}
