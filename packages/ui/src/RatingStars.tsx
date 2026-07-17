import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from './Text';
import type { IconComponent } from './types';

export type RatingStarsProps = {
  value: number;
  /** Star icon (e.g. Lucide Star). Falls back to a ★ glyph if omitted. */
  icon?: IconComponent;
  size?: number;
  showValue?: boolean;
};

export function RatingStars({ value, icon: Icon, size = 14, showValue = true }: RatingStarsProps) {
  const theme = useTheme();

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessibilityLabel={`Rated ${value.toFixed(1)} out of 5`}
    >
      {Icon ? (
        <Icon size={size} color={theme.colors.star} fill={theme.colors.star} />
      ) : (
        <Text style={{ color: theme.colors.star, fontSize: size }}>★</Text>
      )}
      {showValue ? (
        <Text variant="caption" weight="medium" color="primary" tabular>
          {value.toFixed(1)}
        </Text>
      ) : null}
    </View>
  );
}
