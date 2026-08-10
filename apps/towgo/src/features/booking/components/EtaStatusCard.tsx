import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';

const truck = require('@/assets/illustrations/tow-light.png');

export function EtaStatusCard({ etaMinutes }: { etaMinutes: number }) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        ...theme.shadows.card,
      }}
    >
      <Image source={truck} resizeMode="contain" style={{ width: 74, height: 48 }} />

      <View style={{ flex: 1 }}>
        <Text weight="semibold" style={{ fontSize: 15, lineHeight: 21, color: theme.colors.success }}>
          Driver is on the way
        </Text>
        <Text color="secondary" style={{ fontSize: 13, lineHeight: 18 }}>
          Arriving in
        </Text>
      </View>

      <View style={{ alignItems: 'center' }}>
        <Text weight="bold" tabular style={{ fontSize: 28, lineHeight: 32 }}>
          {etaMinutes}
        </Text>
        <Text color="secondary" style={{ fontSize: 13, lineHeight: 17 }}>
          min
        </Text>
      </View>
    </View>
  );
}
