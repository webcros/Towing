import React from 'react';
import { type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';
import { ArrowLeft } from '@/icons';
import { Pressable } from '@/motion';

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
      style={() => [
        {
          // 44 is the minimum tap target (spec 10.11); this was 42.
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.card,
        },
        style,
      ]}
    >
      <ArrowLeft size={20} color={theme.colors.textPrimary} />
    </Pressable>
  );
}
