import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import type { AccountMenuItem, AccountMenuItemId } from '../types';

// Figma grouped list card — r20, border #f3f4f6, rows p16 with dividers,
// icon 22, title 15 Medium / subtitle 13, dark 14px chevron.
export function AccountMenuCard({
  items,
  onItemPress,
}: {
  items: AccountMenuItem[];
  onItemPress: (id: AccountMenuItemId) => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        ...theme.shadows.card,
      }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const isLast = index === items.length - 1;
        return (
          <Pressable
            key={item.id}
            onPress={() => onItemPress(item.id)}
            accessibilityRole="button"
            accessibilityLabel={item.title}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              gap: 16,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.surface1 : theme.colors.card,
            })}
          >
            <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} color={theme.colors.textPrimary} strokeWidth={1.8} />
            </View>

            <View style={{ flex: 1, gap: 1 }}>
              <Text weight="medium" style={{ fontSize: 15, lineHeight: 22.5 }}>
                {item.title}
              </Text>
              <Text color="secondary" style={{ fontSize: 13, lineHeight: 19.5 }} numberOfLines={1}>
                {item.subtitle}
              </Text>
            </View>

            <ChevronRight size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
          </Pressable>
        );
      })}
    </View>
  );
}
