import React from 'react';
import { View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { AppBar, IconButton, Text } from '@towing/ui';
import { Menu, Bell } from '@/icons';
import { useHairlineStyle, useHairlineToken, useTitleHandoff } from '@/motion';
import { Logo } from './Logo';

export type AppHeaderProps = {
  onMenu?: () => void;
  onNotifications?: () => void;
  /** Home and Profile hide it. There is no drawer, so it has nothing to open. */
  showMenu?: boolean;
  /** Profile hides it. Nothing wires `onNotifications`, so it does nothing. */
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

const noop = () => {};

/** Shared top bar (optional menu · TowGo logo · bell) used across primary tabs. */
export function AppHeader({
  onMenu = noop,
  onNotifications = noop,
  showMenu = true,
  showBell = true,
  scrollY,
  title,
}: AppHeaderProps) {
  return (
    <View>
      <AppBar
        // AppBar's left slot keeps its 44dp minWidth when empty, so dropping the
        // button leaves the logo centred rather than shifting it left.
        left={showMenu ? <IconButton icon={Menu} label="Open menu" onPress={onMenu} /> : null}
        center={scrollY && title ? <HandoffCenter scrollY={scrollY} title={title} /> : <Logo />}
        right={
          showBell ? (
            <IconButton
              icon={Bell}
              label="Notifications"
              variant="surface"
              size={17}
              onPress={onNotifications}
              style={{ width: 40, height: 40, borderRadius: 13 }}
            />
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
