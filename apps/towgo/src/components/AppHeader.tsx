import React from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { AppBar, IconButton, Text } from '@towing/ui';
import { Menu, Bell } from '@/icons';
import { useHairlineStyle, useHairlineToken, useTitleHandoff } from '@/motion';
import { useTheme } from '@towing/theme';
import { useUnreadCount } from '@/features/notifications/api/notifications.queries';
import type { RootStackParamList } from '@/navigation/types';
import { Logo } from './Logo';

export type AppHeaderProps = {
  onMenu?: () => void;
  onNotifications?: () => void;
  /** Home and Profile hide it. There is no drawer, so it has nothing to open. */
  showMenu?: boolean;
  /** Profile hides it. Defaults to opening the notification centre (Phase 13). */
  showBell?: boolean;
  /**
   * Scroll offset of the screen this bar sits above. Supplying it turns on the
   * hairline and, with `title`, the large-title handoff.
   */
  scrollY?: SharedValue<number>;
  /**
   * Compact title that fades in as the screen's own large heading scrolls out.
   * Home omits it — HomeHero is the first thing in the scroller, so there is no
   * heading to hand over.
   */
  title?: string;
};

/** Shared top bar (optional menu · MiTow logo · bell) used across primary tabs. */
export function AppHeader({
  onMenu = () => {},
  onNotifications,
  showMenu = true,
  showBell = true,
  scrollY,
  title,
}: AppHeaderProps) {
  const theme = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // The count query is cheap and shared — three tabs render this header, and
  // they all read the same cache entry rather than fetching three times.
  const unread = useUnreadCount();
  const hasUnread = (unread.data?.unread ?? 0) > 0;

  // Phase 13 finally wires this. Until now the prop defaulted to a no-op and
  // the component's own comment said so.
  const openNotifications = onNotifications ?? (() => navigation.navigate('Notifications'));

  return (
    <View>
      <AppBar
        // AppBar's left slot keeps its 44dp minWidth when empty, so dropping the
        // button leaves the logo centred rather than shifting it left.
        left={showMenu ? <IconButton icon={Menu} label="Open menu" onPress={onMenu} /> : null}
        center={scrollY && title ? <HandoffCenter scrollY={scrollY} title={title} /> : <Logo />}
        right={
          showBell ? (
            <View>
              <IconButton
                icon={Bell}
                label={hasUnread ? 'Notifications, unread' : 'Notifications'}
                variant="surface"
                size={17}
                onPress={openNotifications}
                style={{ width: 40, height: 40, borderRadius: 13 }}
              />
              {/*
                A dot, not a count. A numeric pill needs a truncation rule
                ("9+"), a width that does not shift the bar, and a design
                decision nobody has made — and the count is one tap away. It is
                on the design backlog, not silently skipped.
              */}
              {hasUnread ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    backgroundColor: theme.colors.brand,
                    borderWidth: 1.5,
                    borderColor: theme.colors.surface0,
                  }}
                />
              ) : null}
            </View>
          ) : null
        }
      />
      {scrollY ? <Hairline scrollY={scrollY} /> : null}
    </View>
  );
}

/**
 * Logo and compact title stacked on the same spot, crossfading on scroll. The
 * logo stays in flow so the bar keeps its height; the title is overlaid.
 */
function HandoffCenter({ scrollY, title }: { scrollY: SharedValue<number>; title: string }) {
  const { appearing, leaving } = useTitleHandoff(scrollY);

  return (
    <View>
      <Animated.View style={leaving}>
        <Logo />
      </Animated.View>
      <Animated.View
        style={[
          { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center' },
          appearing,
        ]}
      >
        <Text variant="title" weight="semibold" numberOfLines={1} align="center">
          {title}
        </Text>
      </Animated.View>
    </View>
  );
}

function Hairline({ scrollY }: { scrollY: SharedValue<number> }) {
  const style = useHairlineStyle(scrollY);
  const token = useHairlineToken();
  return <Animated.View pointerEvents="none" style={[token, style]} />;
}
