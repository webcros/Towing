import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type RadiusKey } from '@towing/theme';

export type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  padding?: number;
  radius?: RadiusKey;
  elevated?: boolean;
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({
  children,
  onPress,
  padding,
  radius = 'card',
  elevated = true,
  bordered = true,
  style,
  accessibilityLabel,
}: CardProps) {
  const theme = useTheme();

  const containerStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radii[radius],
      padding: padding ?? theme.spacing.lg,
      borderWidth: bordered ? 1 : 0,
      borderColor: theme.colors.borderSubtle,
    },
    elevated && theme.shadows.card,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [containerStyle, { opacity: pressed ? 0.9 : 1 }]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}
