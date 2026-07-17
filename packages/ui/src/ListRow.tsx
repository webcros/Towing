import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from './Text';

export type ListRowProps = {
  leading?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  divider = false,
  style,
}: ListRowProps) {
  const theme = useTheme();

  const content = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderBottomWidth: divider ? 1 : 0,
          borderBottomColor: theme.colors.divider,
        },
        style,
      ]}
    >
      {leading}
      <View style={{ flex: 1 }}>
        {typeof title === 'string' ? (
          <Text variant="body" weight="medium">
            {title}
          </Text>
        ) : (
          title
        )}
        {typeof subtitle === 'string' ? (
          <Text variant="caption" color="secondary">
            {subtitle}
          </Text>
        ) : (
          subtitle
        )}
      </View>
      {trailing}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {content}
      </Pressable>
    );
  }
  return content;
}
