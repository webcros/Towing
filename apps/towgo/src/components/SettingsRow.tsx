import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { ChevronRight } from '@/icons';

export type SettingsRowProps = {
  icon?: IconComponent;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  /** 'chevron' for a nav row, or any node (e.g. a Toggle). */
  trailing?: 'chevron' | React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
};

export function SettingsRow({
  icon: Icon,
  iconColor,
  title,
  subtitle,
  value,
  trailing,
  onPress,
  danger,
}: SettingsRowProps) {
  const theme = useTheme();
  const mainColor = danger ? theme.colors.error : theme.colors.textPrimary;

  const content = (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}
    >
      {Icon ? (
        <View style={{ width: 24, alignItems: 'center' }}>
          <Icon size={20} color={iconColor ?? mainColor} strokeWidth={1.9} />
        </View>
      ) : null}

      <View style={{ flex: 1, gap: 2 }}>
        <Text weight="medium" numberOfLines={1} style={{ fontSize: 15, lineHeight: 20, color: mainColor }}>
          {title}
        </Text>
        {subtitle ? (
          <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text color="secondary" style={{ fontSize: 14, lineHeight: 19 }}>
          {value}
        </Text>
      ) : null}

      {trailing === 'chevron' ? (
        <ChevronRight size={18} color={theme.colors.textTertiary} strokeWidth={2} />
      ) : (
        trailing
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => ({ backgroundColor: pressed ? theme.colors.surface1 : 'transparent' })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}
