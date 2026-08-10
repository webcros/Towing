import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@towing/theme';
import { Text, Button } from '@towing/ui';
import { Info } from '@/icons';
import { formatINR } from '@/utils/format';

// Figma 31:176 — border-top bar: fare + "Total Estimate ⓘ" left, CTA right.
export function BookingBottomBar({ fare, onConfirm }: { fare: number; onConfirm: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
        backgroundColor: theme.colors.card,
        paddingHorizontal: 18,
        paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <View>
        <Text weight="semibold" tabular style={{ fontSize: 20, lineHeight: 25, letterSpacing: -0.5 }}>
          {formatINR(fare)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <Text color="secondary" style={{ fontSize: 12, lineHeight: 18 }}>
            Total Estimate
          </Text>
          <Info size={12} color={theme.colors.textTertiary} />
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <Button label="Confirm Booking" onPress={onConfirm} fullWidth height={47} />
      </View>
    </View>
  );
}
