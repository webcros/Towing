import React from 'react';
import { Image } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import type { QuickAction } from '../mocks/quickActions.data';
import { Pressable } from '@/motion';

export function QuickActionCard({
  action,
  onPress,
}: {
  action: QuickAction;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      style={() => ({
        flex: 1,
        aspectRatio: 79.5 / 86.9,
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 4,
        ...theme.shadows.card,
      })}
    >
      <Image source={action.image} resizeMode="contain" style={{ width: 64, height: 40 }} />
      <Text
        weight="medium"
        align="center"
        numberOfLines={2}
        style={{ fontSize: 10, lineHeight: 14 }}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}
