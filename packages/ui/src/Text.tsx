import React from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme, type FontWeightKey, type TypographyVariant } from '@towing/theme';

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'brand'
  | 'onBrand'
  | 'error'
  | 'success';

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: TextColor;
  weight?: FontWeightKey;
  /** Tabular figures for money / ETA / countdowns (spec §10.4). */
  tabular?: boolean;
  uppercase?: boolean;
  align?: TextStyle['textAlign'];
};

export function Text({
  variant = 'body',
  color = 'primary',
  weight,
  tabular,
  uppercase,
  align,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useTheme();
  const token = theme.typography[variant];
  const resolvedWeight: FontWeightKey = weight ?? token.weight;

  const colorMap: Record<TextColor, string> = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    tertiary: theme.colors.textTertiary,
    inverse: theme.colors.textInverse,
    brand: theme.colors.brand,
    onBrand: theme.colors.onBrand,
    error: theme.colors.error,
    success: theme.colors.success,
  };

  const textStyle: TextStyle = {
    fontFamily: theme.fonts[resolvedWeight],
    fontSize: token.fontSize,
    lineHeight: token.lineHeight,
    letterSpacing: token.letterSpacing,
    color: colorMap[color],
    textAlign: align,
    textTransform: (uppercase ?? token.uppercase) ? 'uppercase' : undefined,
    fontVariant: tabular ? ['tabular-nums'] : undefined,
  };

  return (
    // Cap OS font scaling so accessibility sizes enlarge text without
    // breaking tight layouts (overridable per-instance via rest props).
    <RNText maxFontSizeMultiplier={1.2} style={[textStyle, style]} {...rest}>
      {children}
    </RNText>
  );
}
