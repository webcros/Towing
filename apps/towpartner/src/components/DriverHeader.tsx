import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Menu, ArrowLeft, Bell } from '@/icons';
import { driverColors } from '@/theme/driverColors';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable } from '@/motion';
import { useUnreadCount } from '@/features/notifications/api/notifications.queries';
import type { RootStackParamList } from '@/navigation/types';

export type DriverHeaderProps = {
  title: string;
  subtitle?: string;
  /** Leading control: hamburger (primary tabs) or back arrow (sub-flows). */
  leading?: 'menu' | 'back';
  onLeading?: () => void;
  showBell?: boolean;
  /** Force the unread dot on. Omit and the header reads the real unread count. */
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
  bellBadge,
  onBell,
  titleSize = 26,
  subtitleSize = 13,
}: DriverHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // Six screens render this header; they all read one shared cache entry.
  const unread = useUnreadCount();
  const showDot = bellBadge ?? (unread.data?.unread ?? 0) > 0;
  // Phase 13 wires it. Until now every call site passed nothing and the bell
  // opened a PlaceholderScreen.
  const openBell = onBell ?? (() => navigation.navigate('Notifications'));
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
        pressScale={theme.motion.pressScale.chip}
        style={{ paddingTop: 4 }}
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
          onPress={openBell}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          pressScale={theme.motion.pressScale.chip}
          style={{ paddingTop: 4 }}
        >
          <View>
            <Bell size={24} color={theme.colors.textPrimary} strokeWidth={2} />
            {showDot ? (
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
