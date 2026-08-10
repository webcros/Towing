import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { IconChip } from './IconChip';
import { type ChipTone } from '@/theme/driverColors';
import { Pressable } from '@/motion';

export type MenuRowProps = {
  icon?: IconComponent;
  /** When set, the icon renders inside a coloured chip (Account/Support rows). */
  tone?: ChipTone;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** 'chevron' (default), 'none', or a custom node. */
  trailing?: 'chevron' | 'none' | React.ReactNode;
  danger?: boolean;
  /** Centered single-line row (e.g. Logout). */
  center?: boolean;
};

/** A list row inside a MenuCard: chip icon + title/subtitle + chevron. */
export function MenuRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  onPress,
  trailing = 'chevron',
  danger = false,
  center = false,
}: MenuRowProps) {
  const theme = useTheme();
  const mainColor = danger ? theme.colors.error : theme.colors.textPrimary;

  const renderTrailing = () => {
    if (center) return null;
    if (trailing === 'chevron') {
      return <ChevronRight size={16} color={theme.colors.textTertiary} strokeWidth={2} />;
    }
    if (trailing === 'none') return null;
    return trailing;
  };

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: center ? 'center' : 'flex-start',
        gap: center ? 8 : 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
      }}
    >
      {Icon ? (
        tone ? (
          <IconChip icon={Icon} tone={tone} size={40} iconSize={16} />
        ) : (
          <Icon size={20} color={mainColor} strokeWidth={2} />
        )
      ) : null}

      {center ? (
        <Text style={{ fontSize: 16, lineHeight: 24, color: mainColor }}>{title}</Text>
      ) : (
        <View style={{ flex: 1, gap: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 16, lineHeight: 24, color: mainColor }}>
            {title}
          </Text>
          {subtitle ? (
            <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      )}

      {renderTrailing()}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={title}
        style={({ pressed }) => ({
          backgroundColor: pressed ? theme.colors.surface1 : 'transparent',
        })}
      >
        {content}
      </Pressable>
    );
  }
  return content;
}
