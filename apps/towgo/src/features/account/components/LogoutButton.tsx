import React from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { LogOut } from '@/icons';

// Figma 21:485 — 63px white bordered button, red icon + label, centered.
export function LogoutButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      style={({ pressed }) => ({
        height: 63,
        borderRadius: 14,
        backgroundColor: theme.colors.card,
        borderWidth: 1,
        borderColor: theme.colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <LogOut size={22} color={theme.colors.error} strokeWidth={2} />
      <Text weight="medium" style={{ fontSize: 13, lineHeight: 19.5, color: theme.colors.error }}>
        Log Out
      </Text>
    </Pressable>
  );
}
