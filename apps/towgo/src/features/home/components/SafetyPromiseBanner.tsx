import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { Pressable } from '@/motion';

const shield = require('@/assets/icons/safety-shield.png');

export function SafetyPromiseBanner({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Read our safety guidelines"
      style={() => ({
        backgroundColor: theme.colors.brandTint,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
      })}
    >
      <Image source={shield} resizeMode="contain" style={{ width: 32, height: 32 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="semibold" style={{ fontSize: 15, lineHeight: 22 }}>
          Safe. Reliable. Always.
        </Text>
        <Text color="tertiary" style={{ fontSize: 12, lineHeight: 18, letterSpacing: 0.3 }}>
          We&apos;re here to get you moving.
        </Text>
      </View>
      <ChevronRight size={15} color={theme.colors.textTertiary} />
    </Pressable>
  );
}
