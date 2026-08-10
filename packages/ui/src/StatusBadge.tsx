import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type Theme } from '@towing/theme';
import { Text } from './Text';
import type { IconComponent } from './types';

export type StatusTone = 'success' | 'error' | 'warning' | 'info' | 'neutral';

export type StatusBadgeProps = {
  label: string;
  tone?: StatusTone;
  /** Fully-rounded pill with roomier padding. Off = the original 4px chip. */
  pill?: boolean;
  /** Leading glyph, tinted with the tone's foreground colour. */
  icon?: IconComponent;
  /** Draw the glyph as a solid disc (fill = fg, stroke = bg) instead of an outline. */
  iconFilled?: boolean;
  style?: StyleProp<ViewStyle>;
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
export function StatusBadge({
  label,
  tone = 'neutral',
  pill = false,
  icon: Icon,
  iconFilled = false,
  style,
}: StatusBadgeProps) {
  const theme = useTheme();
  const { bg, fg } = toneColors(tone, theme);

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: Icon ? 5 : 0,
          backgroundColor: bg,
          // Legacy chip metrics — three callers are tuned to them, so the
          // default branch must keep producing 4/9/3 exactly.
          borderRadius: pill ? theme.radii.pill : 4,
          paddingHorizontal: pill ? theme.spacing.md : 9,
          paddingVertical: pill ? 5 : 3,
        },
        style,
      ]}
    >
      {Icon ? (
        <Icon
          size={14}
          color={iconFilled ? bg : fg}
          fill={iconFilled ? fg : undefined}
          strokeWidth={2.2}
        />
      ) : null}
      <Text weight="medium" style={{ color: fg, fontSize: 12, lineHeight: 18, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}
