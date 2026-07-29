import React from 'react';
import { View } from 'react-native';
import { Text } from '@towing/ui';
import type { IconComponent } from '@towing/ui';

export type PillProps = {
  label: string;
  bg: string;
  fg: string;
  icon?: IconComponent;
  /** Border colour, if the pill is outlined. */
  borderColor?: string;
  radius?: number;
  textSize?: number;
};

/** Small rounded tag — "12 min away", vehicle plate, DRIVER ID, etc. */
export function Pill({
  label,
  bg,
  fg,
  icon: Icon,
  borderColor,
  radius = 8,
  textSize = 12,
}: PillProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderWidth: borderColor ? 1 : 0,
        borderColor,
      }}
    >
      {Icon ? <Icon size={textSize} color={fg} strokeWidth={2.2} /> : null}
      <Text weight="medium" style={{ fontSize: textSize, lineHeight: textSize + 5, color: fg }}>
        {label}
      </Text>
    </View>
  );
}
