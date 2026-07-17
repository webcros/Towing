import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from './Text';
import type { IconComponent } from './types';

export type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: IconComponent;
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({
  title,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  style,
}: SectionHeaderProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        style,
      ]}
    >
      <Text variant="label" color="primary">
        {title}
      </Text>

      {actionLabel ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text variant="caption" weight="medium" color="brand">
            {actionLabel}
          </Text>
          {ActionIcon ? <ActionIcon size={16} color={theme.colors.brand} /> : null}
        </Pressable>
      ) : null}
    </View>
  );
}
