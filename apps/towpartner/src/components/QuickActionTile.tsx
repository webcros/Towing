import React from 'react';
import { Pressable } from 'react-native';
import { Text, type IconComponent } from '@towing/ui';

export type QuickActionTileProps = {
  icon: IconComponent;
  label: string;
  /** Tile background tint. */
  bg: string;
  iconColor: string;
  onPress?: () => void;
};

/** One tile in the Home "Quick Actions" row. */
export function QuickActionTile({ icon: Icon, label, bg, iconColor, onPress }: QuickActionTileProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: bg,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 4,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icon size={22} color={iconColor} strokeWidth={2} />
      <Text weight="medium" numberOfLines={1} style={{ fontSize: 11, lineHeight: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}
