import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { useBookingStore } from '../store/bookingStore';
import { Pressable } from '@/motion';

/** Read-only pickup→drop summary shown on Step 2; tap to go back and edit. */
export function LocationSummaryBar({ onEdit }: { onEdit: () => void }) {
  const theme = useTheme();
  const pickup = useBookingStore((s) => s.pickupAddress);
  const drop = useBookingStore((s) => s.dropAddress);

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel="Edit locations"
      style={() => ({
        flex: 1,
        backgroundColor: theme.colors.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 10,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...theme.shadows.card,
      })}
    >
      {/* Timeline dots */}
      <View style={{ alignItems: 'center', width: 12 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.success }} />
        <View
          style={{
            height: 16,
            width: 1,
            borderLeftWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.borderStrong,
            marginVertical: 2,
          }}
        />
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.error }} />
      </View>

      <View style={{ flex: 1, gap: 6 }}>
        <Text weight="medium" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {pickup || 'Pickup location'}
        </Text>
        <View style={{ height: 1, backgroundColor: theme.colors.border }} />
        <Text weight="medium" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20 }}>
          {drop || 'Drop location'}
        </Text>
      </View>
    </Pressable>
  );
}
