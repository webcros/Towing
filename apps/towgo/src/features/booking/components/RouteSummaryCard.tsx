import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { MapPin, Plus } from '@/icons';
import { useBookingStore } from '../store/bookingStore';
import { Pressable } from '@/motion';

/** Read-only labeled pickup/drop summary + add-stop. Tap the card to edit. */
export function RouteSummaryCard({
  onEdit,
  onAddStop,
}: {
  onEdit: () => void;
  onAddStop: () => void;
}) {
  const theme = useTheme();
  const pickup = useBookingStore((s) => s.pickupAddress);
  const drop = useBookingStore((s) => s.dropAddress);

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel="Edit locations"
      style={() => ({
        backgroundColor: theme.colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...theme.shadows.card,
      })}
    >
      {/* Timeline */}
      <View style={{ alignItems: 'center', alignSelf: 'stretch', width: 14 }}>
        <View style={{ height: 40, justifyContent: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.success }} />
        </View>
        <View
          style={{
            flex: 1,
            width: 1,
            borderLeftWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.colors.borderStrong,
          }}
        />
        <View style={{ height: 40, justifyContent: 'center' }}>
          <MapPin size={16} color={theme.colors.error} fill={theme.colors.error} />
        </View>
      </View>

      <View style={{ flex: 1, gap: 12 }}>
        <View style={{ height: 40, justifyContent: 'center' }}>
          <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
            Pickup Location
          </Text>
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>
            {pickup || 'Set pickup'}
          </Text>
        </View>
        <View style={{ height: 40, justifyContent: 'center' }}>
          <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
            Drop Location
          </Text>
          <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>
            {drop || 'Set drop-off'}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onAddStop}
        accessibilityRole="button"
        accessibilityLabel="Add a stop"
        hitSlop={6}
        style={() => ({
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          ...theme.shadows.card,
        })}
      >
        <Plus size={18} color={theme.colors.textPrimary} strokeWidth={2} />
      </Pressable>
    </Pressable>
  );
}
