import React from 'react';
import { Text, type IconComponent } from '@towing/ui';
import { Pressable } from '@/motion';

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
      style={() => ({
        flex: 1,
        backgroundColor: bg,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 21,
        paddingHorizontal: 4,
      })}
    >
      <Icon size={20} color={iconColor} strokeWidth={2} />
      {/* Figma 62:19 tile is 87 tall: 21 + 20 icon + 7 + 18 label + 21. The label is
          10 -- the design value, and exactly the legibility floor. */}
      <Text weight="medium" numberOfLines={1} style={{ fontSize: 10, lineHeight: 18 }}>
        {label}
      </Text>
    </Pressable>
  );
}
