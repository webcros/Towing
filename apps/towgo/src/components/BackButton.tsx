import React from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';
import { ArrowLeft } from '@/icons';

/**
 * Boxed 42px back button used by the full-screen flows (booking, tracking,
 * booking details). Distinct from ScreenHeader's bare arrow, which is the
 * settings/forms treatment.
 */
export function BackButton({
  onPress,
  accessibilityLabel = 'Go back',
  style,
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 42,
          height: 42,
          borderRadius: 11,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.7 : 1,
          ...theme.shadows.card,
        },
        style,
      ]}
    >
      <ArrowLeft size={20} color={theme.colors.textPrimary} />
    </Pressable>
  );
}
