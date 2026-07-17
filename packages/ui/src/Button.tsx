import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type TextColor } from './Text';
import type { IconComponent } from './types';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: IconComponent;
  /** Override the size-derived height (e.g. a Figma-exact 46px CTA). */
  height?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  loading = false,
  disabled = false,
  leftIcon: LeftIcon,
  height: heightOverride,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;
  const height = heightOverride ?? (size === 'lg' ? 52 : 48);

  const backgroundFor = (pressed: boolean): string => {
    switch (variant) {
      case 'primary':
        return pressed ? theme.colors.brandPressed : theme.colors.brand;
      case 'destructive':
        return theme.colors.sos;
      case 'secondary':
        return pressed ? theme.colors.surface1 : theme.colors.card;
      case 'ghost':
        return pressed ? theme.colors.surface1 : 'transparent';
      default:
        return theme.colors.brand;
    }
  };

  const textColor: TextColor =
    variant === 'primary'
      ? 'onBrand'
      : variant === 'destructive'
        ? 'inverse'
        : variant === 'secondary'
          ? 'primary'
          : 'brand';

  const iconColorMap: Record<TextColor, string> = {
    onBrand: theme.colors.onBrand,
    inverse: theme.colors.textInverse,
    primary: theme.colors.textPrimary,
    brand: theme.colors.brand,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    error: theme.colors.error,
    success: theme.colors.success,
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={({ pressed }) => [
        {
          height,
          borderRadius: theme.radii.button,
          backgroundColor: backgroundFor(pressed),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.xl,
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.colors.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={iconColorMap[textColor]} />
      ) : (
        <>
          {LeftIcon ? <LeftIcon size={20} color={iconColorMap[textColor]} /> : null}
          <Text variant="body" weight="semibold" color={textColor}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
