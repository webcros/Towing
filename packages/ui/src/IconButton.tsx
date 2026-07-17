import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';
import type { IconComponent } from './types';

export type IconButtonProps = {
  icon: IconComponent;
  /** Required for screen readers (spec §10.11). */
  label: string;
  onPress?: () => void;
  size?: number;
  color?: string;
  variant?: 'plain' | 'surface';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon: Icon,
  label,
  onPress,
  size = 22,
  color,
  variant = 'plain',
  disabled = false,
  style,
}: IconButtonProps) {
  const theme = useTheme();
  const iconColor = color ?? theme.colors.textPrimary;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          width: 44,
          height: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
        },
        variant === 'surface' && {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radii.button,
          borderWidth: 1,
          borderColor: theme.colors.borderSubtle,
          ...theme.shadows.card,
        },
        style,
      ]}
    >
      <Icon size={size} color={iconColor} />
    </Pressable>
  );
}
