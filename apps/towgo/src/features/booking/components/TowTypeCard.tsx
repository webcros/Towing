import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Info, Check } from '@/icons';
import { formatINR } from '@/utils/format';
import type { TowType } from '../types';
import { Pressable } from '@/motion';

// Figma 31:67. That frame is a 430 design squashed into a 390 artboard (every
// number is an exact x0.907 multiple), so the raw values render ~9%25 small.
// These are the un-squashed intent, snapped to the grid: 145x176, r16.
export function TowTypeCard({
  towType,
  selected,
  onPress,
}: {
  towType: TowType;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={towType.disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: towType.disabled }}
      accessibilityLabel={`${towType.name}, ${towType.categories}, ${formatINR(towType.price)}`}
      style={() => ({
        width: 145,
        height: 176,
        borderRadius: 16,
        paddingHorizontal: 15,
        paddingVertical: 13,
        backgroundColor: selected ? theme.colors.brandTint : theme.colors.card,
        borderWidth: 1,
        borderColor: selected ? theme.colors.brand : theme.colors.border,
        justifyContent: 'space-between',
        // Alpha and elevation are mutually exclusive on one node: on Android the
        // elevation shadow is drawn outside the view's own alpha, so a faded
        // card shows its shadow through itself. A disabled card should not read
        // as raised anyway, so it trades the shadow for the fade.
        ...(towType.disabled ? { opacity: 0.6 } : theme.shadows.card),
      })}
    >
      <Image
        source={towType.image}
        resizeMode="contain"
        style={{ width: 115, height: 56, marginTop: 9 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 21 }}>
          {towType.name}
        </Text>
        {!towType.disabled ? <Info size={14} color={theme.colors.textTertiary} /> : null}
      </View>

      <Text color="secondary" numberOfLines={1} style={{ fontSize: 11, lineHeight: 17, marginBottom: 7 }}>
        {towType.categories}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text weight="semibold" tabular style={{ fontSize: 15, lineHeight: 22 }}>
          {formatINR(towType.price)}
        </Text>
        {towType.comparePrice ? (
          <Text
            color="tertiary"
            tabular
            style={{ fontSize: 11, lineHeight: 17, textDecorationLine: 'line-through' }}
          >
            {formatINR(towType.comparePrice)}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: theme.colors.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={12} color={theme.colors.onBrand} strokeWidth={3} />
        </View>
      ) : null}
    </Pressable>
  );
}
