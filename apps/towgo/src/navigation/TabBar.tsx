import React, { useCallback, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@towing/theme';
import { BottomScrim, Text, type IconComponent } from '@towing/ui';
import { Home, ClipboardList, Wrench, User } from '@/icons';
import { Pressable, haptics } from '@/motion';

const TAB_ICONS: Record<string, IconComponent> = {
  Home,
  Bookings: ClipboardList,
  Services: Wrench,
  Profile: User,
};

/** Pill height at the reference width; scaled per viewport at render time. */
const BAR_H = 64;
/** Inset from the screen edges. */
const H_MARGIN = 16;
/** Clearance between the pill and the last line of scroll content. */
const CONTENT_GAP = 12;

/** How far the scrim's fade reaches above the pill. */
const SCRIM_EXTRA = 32;

/** Row padding and per-item margin — the chip geometry is derived from these. */
const ROW_PAD = 5;
const ITEM_MARGIN = 3;

/**
 * Bottom clearance a scrolling screen must reserve so its last row is not hidden
 * behind the floating bar. Mirrors the driver app's hook of the same name.
 */
export function useTabBarSpace(): number {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, theme.spacing.md) + theme.scale(BAR_H) + CONTENT_GAP;
}

type TabItemProps = {
  routeName: string;
  focused: boolean;
  chipHeight: number;
  onPress: () => void;
};

/**
 * One tab. A component rather than inline JSX because each item owns hooks.
 *
 * Icon colour, icon strokeWidth and font weight are all un-animatable — the
 * first two are SVG props on a lucide component that exposes no animated
 * variant, the third is a text style. So each is rendered twice, inactive
 * beneath and active absolutely positioned over it, with their opacity
 * crossfaded. That buys a real colour-and-weight dissolve instead of a discrete
 * swap, for the cost of one extra SVG per tab.
 */
function TabItem({ routeName, focused, chipHeight, onPress }: TabItemProps) {
  const theme = useTheme();
  const Icon = TAB_ICONS[routeName] ?? Home;
  const iconSize = theme.sizes.icon.lg;
  const snappy = theme.motion.spring.snappy;

  const progress = useDerivedValue(() => withSpring(focused ? 1 : 0, snappy));

  const iconStackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.08]) }],
  }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <Pressable
      onPress={onPress}
      pressScale={theme.motion.pressScale.chip}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={routeName}
      style={{
        flex: 1,
        height: chipHeight,
        marginHorizontal: ITEM_MARGIN,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
      }}
    >
      <Animated.View style={[{ width: iconSize, height: iconSize }, iconStackStyle]}>
        <Animated.View style={inactiveStyle}>
          <Icon size={iconSize} color={theme.colors.tabInactive} strokeWidth={2} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute' }, activeStyle]}>
          <Icon size={iconSize} color={theme.colors.tabActive} strokeWidth={2.4} />
        </Animated.View>
      </Animated.View>

      {/* The SEMIBOLD copy sits in flow and defines the layout; the medium one is
          overlaid on it, so the weight change cannot shift anything.

          The wider variant has to be the one in flow. Sizing this box to the
          medium copy left the semibold copy a couple of dp short, and once RN
          has to fit an ellipsis as well it drops two characters — which is why
          the selected tab read "Bookin…" and "Servic…" while every unselected
          label was fine. */}
      <View>
        <Animated.View style={activeStyle}>
          <Text
            variant="label"
            weight="semibold"
            numberOfLines={1}
            style={{ color: theme.colors.tabActive }}
          >
            {routeName}
          </Text>
        </Animated.View>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0 }, inactiveStyle]}>
          <Text
            variant="label"
            weight="medium"
            numberOfLines={1}
            align="center"
            style={{ color: theme.colors.tabInactive }}
          >
            {routeName}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

/**
 * Floating pill nav: a stadium-shaped bar inset from the screen edges, with a
 * rounded chip that springs between tabs.
 *
 * The wrapper is absolutely positioned and has **no background of its own** —
 * content scrolls behind the pill and screens reserve room with
 * `useTabBarSpace()`. An in-flow wrapper with a background paints a visible
 * band across the foot of every screen, which is the bug this replaces (and the
 * same one the driver bar already avoids this way). The moving chip is an extra
 * absolutely-positioned child *inside* the existing row, never a new wrapper,
 * so that fix stays intact.
 */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const barHeight = theme.scale(BAR_H);
  const chipHeight = theme.scale(54);
  const snappy = theme.motion.spring.snappy;

  // Items are flex: 1 in a row of known padding, so one row measurement gives
  // every chip position. Simpler and race-free next to four onLayout callbacks,
  // and it keeps the chip width constant so only translateX ever animates.
  const [rowWidth, setRowWidth] = useState(0);
  const count = state.routes.length;
  const itemWidth = rowWidth > 0 ? (rowWidth - ROW_PAD * 2) / count : 0;
  const chipWidth = Math.max(itemWidth - ITEM_MARGIN * 2, 0);

  // -1 means "not measured yet" and holds the chip hidden, so it never paints a
  // frame at x=0 before the real geometry arrives.
  const chipX = useSharedValue(-1);

  const onRowLayout = useCallback((e: LayoutChangeEvent) => {
    setRowWidth(e.nativeEvent.layout.width);
  }, []);

  const targetX = ROW_PAD + state.index * itemWidth + ITEM_MARGIN;

  React.useEffect(() => {
    if (itemWidth <= 0) return;
    if (chipX.value < 0) {
      chipX.value = targetX; // first placement: no travel from nowhere
    } else {
      chipX.value = withSpring(targetX, snappy);
    }
  }, [targetX, itemWidth, chipX, snappy]);

  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipX.value < 0 ? 0 : 1,
    transform: [{ translateX: Math.max(chipX.value, 0) }],
  }));

  const barBottom = Math.max(insets.bottom, theme.spacing.md);
  const scrimHeight = barBottom + barHeight + SCRIM_EXTRA;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: scrimHeight,
      }}
    >
      {/* Full-bleed, so it has to sit outside the H_MARGIN inset below. */}
      <BottomScrim height={scrimHeight} />

      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: H_MARGIN,
          right: H_MARGIN,
          bottom: barBottom,
        }}
      >
        <View
          onLayout={onRowLayout}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            height: barHeight,
            // Stadium: radius is half the height, so the ends are true semicircles.
            borderRadius: barHeight / 2,
            backgroundColor: theme.colors.tabBarBg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            paddingHorizontal: ROW_PAD,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 14,
            elevation: 8,
          }}
        >
          {/* Declared first so it paints behind the items. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: (barHeight - chipHeight) / 2,
                width: chipWidth,
                height: chipHeight,
                borderRadius: chipHeight / 2,
                backgroundColor: theme.colors.brandTint,
              },
              chipStyle,
            ]}
          />

          {state.routes.map((route, index) => {
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                haptics.selection();
                navigation.navigate(route.name);
              }
            };

            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                focused={focused}
                chipHeight={chipHeight}
                onPress={onPress}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
