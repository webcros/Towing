import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { ChevronDown } from '@/icons';

// Figma 31:138 — white bordered row, label left, brand value + chevron right.
export function BookingOptionRow({
  icon: Icon,
  label,
  value,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.card,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 15.5,
        paddingVertical: 12,
        opacity: pressed ? 0.8 : 1,
        ...theme.shadows.card,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 }}>
        <Icon size={15} color={theme.colors.textPrimary} strokeWidth={2} />
        <Text color="secondary" numberOfLines={1} style={{ fontSize: 11.3, lineHeight: 17, letterSpacing: 0.28 }}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text weight="medium" style={{ fontSize: 11.8, lineHeight: 17.7, color: theme.colors.brand }}>
          {value}
        </Text>
        <ChevronDown size={12} color={theme.colors.brand} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
