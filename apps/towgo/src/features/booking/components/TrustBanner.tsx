import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';

const shield = require('@/assets/icons/safety-shield.png');

/** "Safe. Reliable. Always." trust banner — shared across booking screens. */
export function TrustBanner() {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.brandTint,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
      }}
    >
      <Image source={shield} resizeMode="contain" style={{ width: 33, height: 33 }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text weight="semibold" style={{ fontSize: 14, lineHeight: 20 }}>
          Safe. Reliable. Always.
        </Text>
        <Text color="secondary" style={{ fontSize: 12.5, lineHeight: 17 }}>
          Your safety is our top priority.
        </Text>
      </View>
    </View>
  );
}
