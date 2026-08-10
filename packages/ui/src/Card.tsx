import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme, type RadiusKey } from '@towing/theme';
import { usePressablePrimitive } from './PressableSlot';

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
  const Pressable = usePressablePrimitive();

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
        pressScale={theme.motion.pressScale.card}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        // No press opacity: this node carries elevation, and on Android an
        // elevation shadow is drawn outside its own view's alpha. Fading the
        // card makes the shadow show through it. MotionPressable already
        // supplies press feedback via pressScale, so the alpha was redundant.
        style={containerStyle}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}
