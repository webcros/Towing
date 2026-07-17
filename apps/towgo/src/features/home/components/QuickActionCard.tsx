import React from 'react';
import { Image, Pressable } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import type { QuickAction } from '../mocks/quickActions.data';

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
      style={({ pressed }) => ({
        flex: 1,
        aspectRatio: 79.5 / 86.9,
        backgroundColor: theme.colors.card,
        borderRadius: 14.5,
        borderWidth: 1,
        borderColor: theme.colors.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 4,
        opacity: pressed ? 0.85 : 1,
        ...theme.shadows.card,
      })}
    >
      <Image source={action.image} resizeMode="contain" style={{ width: 64, height: 40 }} />
      <Text
        weight="medium"
        align="center"
        numberOfLines={2}
        style={{ fontSize: 9.5, lineHeight: 11.5 }}
      >
        {action.label}
      </Text>
    </Pressable>
  );
}
