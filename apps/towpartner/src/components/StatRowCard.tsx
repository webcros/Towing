import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { IconChip } from './IconChip';
import type { ChipTone } from '@/theme/driverColors';

export type StatItem = {
  icon: IconComponent;
  tone: ChipTone;
  value: string;
  label: string;
  tabular?: boolean;
};

export type StatRowCardProps = {
  items: StatItem[];
  chipSize?: number;
  /** Value font size — smaller for 4-up rows (Earnings / Profile). */
  valueSize?: number;
  /** Label font size — 11 on Home, 10 on the tighter Profile row (Figma). */
  labelSize?: number;
  /** Vertical hairlines between columns (Home summary uses them). */
  dividers?: boolean;
};

/** Bordered card of evenly-spaced icon-chip stat columns (Home / Earnings / Profile). */
export function StatRowCard({
  items,
  chipSize = 48,
  valueSize = 19,
  labelSize = 11,
  dividers = true,
}: StatRowCardProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 20,
        ...theme.shadows.card,
      }}
    >
      {items.map((item, i) => (
        <React.Fragment key={item.label}>
          {dividers && i > 0 ? (
            <View style={{ width: 1, backgroundColor: theme.colors.border, marginVertical: 2 }} />
          ) : null}
          <View style={{ flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 4 }}>
            <IconChip icon={item.icon} tone={item.tone} size={chipSize} />
            <Text
              weight="semibold"
              tabular={item.tabular}
              numberOfLines={1}
              style={{ fontSize: valueSize, lineHeight: valueSize + 5, flexShrink: 1 }}
            >
              {item.value}
            </Text>
            {/* Labels may wrap to two centered lines — never ellipsize. */}
            <Text
              color="secondary"
              numberOfLines={2}
              align="center"
              style={{ fontSize: labelSize, lineHeight: labelSize + 4 }}
            >
              {item.label}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}
