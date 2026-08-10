import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';
import { usePressablePrimitive } from './PressableSlot';
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
  const Pressable = usePressablePrimitive();
  // `surface` can no longer dim itself with alpha (see the style below), so a
  // disabled one dims its glyph instead. `plain` still uses alpha, so dimming
  // the glyph too would double up.
  const iconColor =
    color ??
    (disabled && variant === 'surface' ? theme.colors.textTertiary : theme.colors.textPrimary);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      pressScale={theme.motion.pressScale.chip}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        // `plain` carries no elevation, so alpha is safe on it.
        variant === 'plain' && { opacity: disabled ? 0.4 : pressed ? 0.6 : 1 },
        // `surface` carries elevation, and on Android an elevation shadow is
        // drawn outside its own view's alpha — fading this node makes the
        // shadow show through the button. Dim with tokens instead, and let
        // MotionPressable's scale carry the press.
        variant === 'surface' && {
          backgroundColor: disabled ? theme.colors.surface1 : theme.colors.card,
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
