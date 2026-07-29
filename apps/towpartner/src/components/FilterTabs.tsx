import React from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { driverColors } from '@/theme/driverColors';

export type FilterTabOption<T extends string> = {
  key: T;
  label: string;
  icon?: IconComponent;
};

export type FilterTabsProps<T extends string> = {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (key: T) => void;
};

const ACTIVE_BG = '#FEF6E6';
const ACTIVE_FG = '#D08700';

/** Horizontal segmented pills — Jobs status filter / Earnings period selector. */
export function FilterTabs<T extends string>({ options, value, onChange }: FilterTabsProps<T>) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingRight: 4 }}
    >
      {options.map((option) => {
        const active = option.key === value;
        const fg = active ? ACTIVE_FG : theme.colors.textSecondary;
        const Icon = option.icon;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 9,
              borderRadius: 9999,
              backgroundColor: active ? ACTIVE_BG : 'transparent',
              borderWidth: 1,
              borderColor: active ? driverColors.gold : theme.colors.border,
            }}
          >
            {Icon ? <Icon size={14} color={fg} strokeWidth={2} /> : null}
            <Text weight={active ? 'semibold' : 'medium'} style={{ fontSize: 13, color: fg }}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
