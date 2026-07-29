import React from 'react';
import { Image, Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Info, Check } from '@/icons';
import { formatINR } from '@/utils/format';
import type { TowType } from '../types';

// Figma 31:67 — 131.5×159.4, r14.5; selected = brandTint bg + brand border +
// brand check badge top-right.
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
      style={({ pressed }) => ({
        width: 132,
        height: 160,
        borderRadius: 14.5,
        paddingHorizontal: 13.5,
        paddingVertical: 12,
        backgroundColor: selected ? theme.colors.brandTint : theme.colors.card,
        borderWidth: 1,
        borderColor: selected ? theme.colors.brand : theme.colors.border,
        justifyContent: 'space-between',
        opacity: towType.disabled ? 0.6 : pressed ? 0.9 : 1,
        ...theme.shadows.card,
      })}
    >
      <Image
        source={towType.image}
        resizeMode="contain"
        style={{ width: 104, height: 51, marginTop: 8 }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text weight="semibold" numberOfLines={1} style={{ fontSize: 12.7, lineHeight: 19 }}>
          {towType.name}
        </Text>
        {!towType.disabled ? <Info size={12.7} color={theme.colors.textTertiary} /> : null}
      </View>

      <Text color="secondary" numberOfLines={1} style={{ fontSize: 10.4, lineHeight: 15.6, marginBottom: 6 }}>
        {towType.categories}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text weight="semibold" tabular style={{ fontSize: 13.2, lineHeight: 19.7 }}>
          {formatINR(towType.price)}
        </Text>
        {towType.comparePrice ? (
          <Text
            color="tertiary"
            tabular
            style={{ fontSize: 10, lineHeight: 15, textDecorationLine: 'line-through' }}
          >
            {formatINR(towType.comparePrice)}
          </Text>
        ) : null}
      </View>

      {selected ? (
        <View
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            width: 20,
            height: 20,
            borderRadius: 10,
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
