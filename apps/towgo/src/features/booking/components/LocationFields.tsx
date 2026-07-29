import React from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { ArrowUpDown } from '@/icons';
import { useBookingStore } from '../store/bookingStore';

export type LocationField = 'pickup' | 'drop';

/**
 * Label-less address entry (Rapido pattern): two single-line inputs whose
 * placeholder text names the field ("Pickup location" / "Drop location"), with
 * green/red timeline dots as the indicator and a swap control.
 */
export function LocationFields({
  onFocusField,
}: {
  onFocusField?: (field: LocationField) => void;
}) {
  const theme = useTheme();
  const pickupAddress = useBookingStore((s) => s.pickupAddress);
  const dropAddress = useBookingStore((s) => s.dropAddress);
  const setPickupAddress = useBookingStore((s) => s.setPickupAddress);
  const setDropAddress = useBookingStore((s) => s.setDropAddress);
  const swapAddresses = useBookingStore((s) => s.swapAddresses);

  const inputStyle = {
    flex: 1,
    fontFamily: theme.fonts.medium,
    fontSize: 15,
    height: 44,
    color: theme.colors.textPrimary,
    padding: 0,
    margin: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  } as const;

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        ...theme.shadows.card,
      }}
    >
      {/* Timeline dots aligned to each row */}
      <View style={{ alignItems: 'center', alignSelf: 'stretch', width: 12 }}>
        <View style={{ height: 44, justifyContent: 'center' }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 3,
              borderColor: theme.colors.success,
              backgroundColor: theme.colors.card,
            }}
          />
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
        <View style={{ height: 44, justifyContent: 'center' }}>
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              borderWidth: 3,
              borderColor: theme.colors.error,
              backgroundColor: theme.colors.card,
            }}
          />
        </View>
      </View>

      {/* Two inputs, hairline-divided */}
      <View style={{ flex: 1 }}>
        <TextInput
          value={pickupAddress}
          onChangeText={setPickupAddress}
          onFocus={() => onFocusField?.('pickup')}
          placeholder="Pickup location"
          placeholderTextColor={theme.colors.textTertiary}
          style={inputStyle}
          autoCorrect={false}
          returnKeyType="next"
          accessibilityLabel="Pickup location"
        />
        <View style={{ height: 1, backgroundColor: theme.colors.border }} />
        <TextInput
          value={dropAddress}
          onChangeText={setDropAddress}
          onFocus={() => onFocusField?.('drop')}
          placeholder="Drop location"
          placeholderTextColor={theme.colors.textTertiary}
          style={inputStyle}
          autoCorrect={false}
          returnKeyType="done"
          accessibilityLabel="Drop location"
        />
      </View>

      {/* Swap */}
      <Pressable
        onPress={swapAddresses}
        accessibilityRole="button"
        accessibilityLabel="Swap pickup and drop locations"
        hitSlop={6}
        style={({ pressed }) => ({
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: theme.colors.surface1,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <ArrowUpDown size={15} color={theme.colors.textSecondary} />
      </Pressable>
    </View>
  );
}
