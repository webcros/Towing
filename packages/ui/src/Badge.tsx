import React from 'react';
import { View } from 'react-native';
import { useTheme, type Theme } from '@towing/theme';
import { Text, type TextColor } from './Text';

export type BadgeTone = 'neutral' | 'brand' | 'success' | 'warning' | 'error';

export type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

function toneColors(tone: BadgeTone, theme: Theme): { bg: string; text: TextColor } {
  switch (tone) {
    case 'brand':
      return { bg: theme.colors.brandTint, text: 'primary' };
    case 'success':
      return { bg: theme.colors.surface1, text: 'success' };
    case 'warning':
      return { bg: theme.colors.surface1, text: 'primary' };
    case 'error':
      return { bg: theme.colors.surface1, text: 'error' };
    default:
      return { bg: theme.colors.surface1, text: 'secondary' };
  }
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const theme = useTheme();
  const { bg, text } = toneColors(tone, theme);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: theme.radii.pill,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 3,
      }}
    >
      <Text variant="micro" weight="semibold" color={text} uppercase>
        {label}
      </Text>
    </View>
  );
}
