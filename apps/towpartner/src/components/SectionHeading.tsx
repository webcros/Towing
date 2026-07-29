import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@towing/ui';
import { driverColors } from '@/theme/driverColors';

export type SectionHeadingProps = {
  title: string;
  /** Optional trailing action, e.g. "View All" in orange. */
  actionLabel?: string;
  onAction?: () => void;
  /** 19 on Home/Earnings, 18 on Profile (Figma). */
  size?: number;
};

/** Semibold section title with an optional orange action (Figma driver). */
export function SectionHeading({ title, actionLabel, onAction, size = 19 }: SectionHeadingProps) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Text weight="semibold" style={{ fontSize: size, lineHeight: size + 7, letterSpacing: -0.2 }}>
        {title}
      </Text>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text weight="medium" style={{ fontSize: 15, color: driverColors.accent }}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
