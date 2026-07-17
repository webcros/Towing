import React from 'react';
import { View } from 'react-native';
import { useTheme, type Theme } from '@towing/theme';
import { Text } from './Text';

export type StatusTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
};

function toneColors(tone: StatusTone, theme: Theme): { bg: string; fg: string } {
  switch (tone) {
    case 'success':
      return { bg: theme.colors.successSoftBg, fg: theme.colors.successSoftFg };
    case 'error':
      return { bg: theme.colors.errorSoftBg, fg: theme.colors.errorSoftFg };
    case 'warning':
      return { bg: theme.colors.warningSoftBg, fg: theme.colors.warningSoftFg };
    case 'info':
      return { bg: theme.colors.infoSoftBg, fg: theme.colors.infoSoftFg };
    default:
      return { bg: theme.colors.surface1, fg: theme.colors.textSecondary };
  }
}

/** Soft status pill (e.g. "Completed") — subtle bg + strong text. */
export function StatusBadge({ label, tone = 'neutral' }: StatusBadgeProps) {
  const theme = useTheme();
  const { bg, fg } = toneColors(tone, theme);

  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: 4,
        paddingHorizontal: 9,
        paddingVertical: 3,
      }}
    >
      <Text weight="medium" style={{ color: fg, fontSize: 12, lineHeight: 18, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}
