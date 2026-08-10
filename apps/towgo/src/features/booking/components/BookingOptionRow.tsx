import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { ChevronDown } from '@/icons';
import { Pressable } from '@/motion';

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
      style={() => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: theme.colors.card,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 17,
        paddingVertical: 12,
        ...theme.shadows.card,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 }}>
        <Icon size={15} color={theme.colors.textPrimary} strokeWidth={2} />
        <Text color="secondary" numberOfLines={1} style={{ fontSize: 12, lineHeight: 18, letterSpacing: 0.3 }}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text weight="medium" style={{ fontSize: 13, lineHeight: 19, color: theme.colors.brand }}>
          {value}
        </Text>
        <ChevronDown size={12} color={theme.colors.brand} strokeWidth={2.4} />
      </View>
    </Pressable>
  );
}
