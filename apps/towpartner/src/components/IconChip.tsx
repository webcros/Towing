import React from 'react';
import { View } from 'react-native';
import type { IconComponent } from '@towing/ui';
import { driverColors, type ChipTone } from '@/theme/driverColors';

export type IconChipProps = {
  icon: IconComponent;
  /** Named colour family (soft bg + solid glyph). Ignored if bg/fg are set. */
  tone?: ChipTone;
  size?: number;
  iconSize?: number;
  /** Explicit overrides (e.g. the gold FAB chip). */
  bg?: string;
  fg?: string;
};

/** Circular coloured icon badge — the recurring chip across every driver screen. */
export function IconChip({ icon: Icon, tone = 'gold', size = 48, iconSize, bg, fg }: IconChipProps) {
  const palette = driverColors.chip[tone];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg ?? palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={iconSize ?? Math.round(size * 0.42)} color={fg ?? palette.fg} strokeWidth={2} />
    </View>
  );
}
