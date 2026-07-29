import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Menu, ArrowLeft, Bell } from '@/icons';
import { driverColors } from '@/theme/driverColors';

export type DriverHeaderProps = {
  title: string;
  subtitle?: string;
  /** Leading control: hamburger (primary tabs) or back arrow (sub-flows). */
  leading?: 'menu' | 'back';
  onLeading?: () => void;
  showBell?: boolean;
  /** Show the unread dot on the bell. */
  bellBadge?: boolean;
  onBell?: () => void;
  /** Greeting screens use 22; single-word titles use the default 26. */
  titleSize?: number;
  subtitleSize?: number;
};

const noop = () => {};

/** Top header used across driver screens (menu/back · title[/subtitle] · bell). */
export function DriverHeader({
  title,
  subtitle,
  leading = 'menu',
  onLeading = noop,
  showBell = true,
  bellBadge = false,
  onBell = noop,
  titleSize = 26,
  subtitleSize = 13,
}: DriverHeaderProps) {
  const theme = useTheme();
  const LeadingIcon = leading === 'back' ? ArrowLeft : Menu;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 16,
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 8,
      }}
    >
      <Pressable
        onPress={onLeading}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={leading === 'back' ? 'Go back' : 'Open menu'}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingTop: 4 })}
      >
        <LeadingIcon size={24} color={theme.colors.textPrimary} strokeWidth={2} />
      </Pressable>

      <View style={{ flex: 1 }}>
        <Text
          weight="semibold"
          numberOfLines={1}
          style={{ fontSize: titleSize, lineHeight: titleSize + 6, letterSpacing: -0.3 }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            color="secondary"
            numberOfLines={1}
            style={{ fontSize: subtitleSize, lineHeight: subtitleSize + 7 }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      {showBell ? (
        <Pressable
          onPress={onBell}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingTop: 4 })}
        >
          <View>
            <Bell size={22} color={theme.colors.textPrimary} strokeWidth={2} />
            {bellBadge ? (
              <View
                style={{
                  position: 'absolute',
                  top: -1,
                  right: -1,
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: driverColors.gold,
                  borderWidth: 1.5,
                  borderColor: theme.colors.surface0,
                }}
              />
            ) : null}
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
