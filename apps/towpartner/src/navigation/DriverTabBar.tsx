import React, { useCallback, useState } from 'react';
import { View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, FeDropShadow, Filter, Path } from 'react-native-svg';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@towing/theme';
import { BottomScrim, Text, useBottomBarOffset, type IconComponent } from '@towing/ui';
import { Home, ClipboardList, Wallet, User, TowTruckIcon } from '@/icons';
import { driverColors } from '@/theme/driverColors';
import { Pressable, haptics } from '@/motion';

const TAB_ICONS: Record<string, IconComponent> = {
  Home,
  Jobs: ClipboardList,
  Earnings: Wallet,
  Profile: User,
};

const TAB_LABELS: Record<string, string> = {
  Home: 'Home',
  Jobs: 'Jobs',
  NewJob: 'New Job',
  Earnings: 'Earnings',
  Profile: 'Profile',
};

// Geometry from Figma 62:175 — floating 88px bar, Ø64 notch whose center sits
// 10px below the bar's top edge, Ø58 FAB concentric in the notch.
const H_MARGIN = 20;
const BAR_H = 88;
/**
 * Outer corner radius. Measured off the design render at ~0.46 of the bar's
 * height; 26 (0.30) read as visibly square against it.
 */
const RADIUS = 40;
const NOTCH_R = 33;
const NOTCH_CY = 10;
const FAB_SIZE = 58;
/** Transparent strip above the bar that the FAB pokes into. */
const STRIP = FAB_SIZE / 2 - NOTCH_CY + 1;

/**
 * Horizontal breathing room inside the chip, around the label.
 *
 * This used to be 14, which is what wrapped the labels. The bar is
 * `width - 2*H_MARGIN` split five ways — 70dp a slot at the 390dp reference —
 * so 14 each side left 42dp for text, and "Earnings" at 12dp semibold needs
 * ~48dp. Every screen width wrapped it onto two lines.
 */
const CONTENT_PAD_H = 4;
/**
 * Vertical padding inside the chip.
 *
 * Sized so the chip comes out roughly square (60 x 59 at the 390dp reference),
 * because that is what the reference does and it is what the corner radius
 * depends on. At the old 6 the chip was 60 x 51, and a stadium radius on a box
 * that shape leaves only 9dp of straight edge across 60dp of width — 85% of the
 * outline is the two round ends, so it renders as an ellipse. No radius value
 * fixes that; the proportions have to change first.
 */
const CHIP_PAD_V = 10;
/** Gap between the chip and its slot edges. The chip is slot-derived, not
 *  content-derived, so a long label cannot squeeze it. */
const CHIP_MARGIN = 5;
/** Corner radius as a fraction of the chip's height. Works because the chip is
 *  near-square; on a short, wide box the same ratio reads as a plain rectangle. */
const CHIP_RADIUS_RATIO = 0.29;

/**
 * Shadow, matched to the customer bar (offset 0/4, radius 14, black at 0.08).
 * `stdDeviation` is roughly half a CSS/RN blur radius, hence 7.
 *
 * Drawn inside the SVG rather than as an `elevation` on the wrapping View,
 * because Android derives an elevation shadow from the view's *outline* — a
 * rectangle, or a rounded rect if borderRadius is set. This bar is a path with
 * a circular notch cut out of it, so an outline-derived shadow would trace the
 * wrong silhouette and cast straight across the notch. A filter operates on the
 * rendered path, notch included.
 */
const SHADOW_DY = 4;
const SHADOW_STD = 7;
const SHADOW_OPACITY = 0.08;
/** Slack around the canvas so the blur is not clipped at the bar's edges. */
const SHADOW_PAD = 24;

/** How far the scrim's fade reaches above the bar. */
const SCRIM_EXTRA = 32;

const INACTIVE = '#374151';
/** Soft orange wash behind the active tab, matching driverColors.accent. */
const ACTIVE_CHIP = '#FFF1E6';

/**
 * Clearance scroll content needs so its last items can rest above the
 * floating bar (bar + FAB strip + bottom margin + breathing room).
 */
export function useTabBarSpace(): number {
  const bottomOffset = useBottomBarOffset();
  return bottomOffset + BAR_H + STRIP + 12;
}

/**
 * Rounded-rect bar with a circular notch cut out (evenodd fill rule).
 *
 * Takes an origin so the whole shape can be inset inside a larger canvas — the
 * canvas is padded by SHADOW_PAD so the drop shadow has room to blur into.
 */
function barPath(w: number, ox = 0, oy = 0): string {
  const r = RADIUS;
  const left = ox;
  const right = ox + w;
  const top = oy;
  const bottom = oy + BAR_H;
  const cx = ox + w / 2;
  const ncy = oy + NOTCH_CY;
  return [
    `M ${left + r} ${top}`,
    `H ${right - r}`,
    `A ${r} ${r} 0 0 1 ${right} ${top + r}`,
    `V ${bottom - r}`,
    `A ${r} ${r} 0 0 1 ${right - r} ${bottom}`,
    `H ${left + r}`,
    `A ${r} ${r} 0 0 1 ${left} ${bottom - r}`,
    `V ${top + r}`,
    `A ${r} ${r} 0 0 1 ${left + r} ${top}`,
    'Z',
    `M ${cx - NOTCH_R} ${ncy}`,
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${cx + NOTCH_R} ${ncy}`,
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${cx - NOTCH_R} ${ncy}`,
    'Z',
  ].join(' ');
}

type TabItemProps = {
  routeName: string;
  focused: boolean;
  onPress: () => void;
  /** Height only — the chip's width comes from the slot, not the content. */
  onMeasure: (size: { height: number }) => void;
};

/**
 * One side tab. A component rather than inline JSX because each item owns hooks.
 *
 * Icon colour, icon strokeWidth and font weight are all un-animatable — the
 * first two are SVG props and the third is a text style — so each is rendered
 * twice, inactive beneath and active overlaid, and their opacity is crossfaded.
 *
 * The **semibold** label is the copy in flow, because it is the wider of the
 * two — laying out against the medium copy would make the selected label
 * overflow its own box. Both carry numberOfLines={1}: at five slots there is
 * only ~62dp of text width, so an unguarded label wraps rather than truncates,
 * which is how this bar shipped "Earni/ngs" and "Profil/e".
 */
function TabItem({ routeName, focused, onPress, onMeasure }: TabItemProps) {
  const theme = useTheme();
  const Icon = TAB_ICONS[routeName] ?? Home;
  const label = TAB_LABELS[routeName] ?? routeName;
  const snappy = theme.motion.spring.snappy;

  const progress = useDerivedValue(() => withSpring(focused ? 1 : 0, snappy));

  const iconStackStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(progress.value, [0, 1], [1, 1.08]) }],
  }));
  const activeStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      onMeasure({ height: e.nativeEvent.layout.height });
    },
    [onMeasure],
  );

  return (
    <Pressable
      onPress={onPress}
      pressScale={theme.motion.pressScale.chip}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{
        flex: 1,
        alignItems: 'center',
        // Centre in the bar rather than a magic paddingTop: the notch only cuts
        // the middle slot, so side tabs get the full height.
        justifyContent: 'center',
      }}
    >
      <View
        onLayout={handleLayout}
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          paddingHorizontal: CONTENT_PAD_H,
          paddingVertical: CHIP_PAD_V,
        }}
      >
        <Animated.View style={[{ width: 16, height: 16 }, iconStackStyle]}>
          <Animated.View style={inactiveStyle}>
            <Icon size={16} color={INACTIVE} strokeWidth={2} />
          </Animated.View>
          <Animated.View style={[{ position: 'absolute' }, activeStyle]}>
            <Icon size={16} color={driverColors.accent} strokeWidth={2.4} />
          </Animated.View>
        </Animated.View>

        <View>
          <Animated.View style={activeStyle}>
            <Text
              weight="semibold"
              numberOfLines={1}
              style={{ fontSize: 12, color: driverColors.accent }}
            >
              {label}
            </Text>
          </Animated.View>
          <Animated.View style={[{ position: 'absolute', left: 0, right: 0 }, inactiveStyle]}>
            <Text
              weight="medium"
              align="center"
              numberOfLines={1}
              style={{ fontSize: 12, color: INACTIVE }}
            >
              {label}
            </Text>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Driver bottom nav (Figma 62:175) — a floating rounded bar with a true
 * cut-out notch holding the gold "New Job" FAB; active tab = orange.
 *
 * The chip behind the active tab springs between slots. Its width comes from
 * the slot rather than from the label: a content-hugging chip has to be as wide
 * as its text, and at five slots in `width - 40` there is not enough room for
 * "Earnings" to sit inside one. Slot-derived means only `translateX` animates,
 * the pill's round ends never distort, and no label can squeeze the chip.
 *
 * Scene transitions are deliberately left off (bottom-tabs' default). Fading
 * between scenes leaves two mounted, semi-transparent screens stacked on top of
 * each other — the customer app shipped that once and it read as a grey wash of
 * two screens at once.
 */
export function DriverTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const bottomOffset = useBottomBarOffset();
  const { width } = useWindowDimensions();
  const barW = width - H_MARGIN * 2;

  // Height only. It is the same for every tab, but measuring rather than
  // hardcoding keeps the chip correct when the OS font scale changes.
  const [chipHeight, setChipHeight] = useState(0);

  const handlePress = (routeName: string, routeKey: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      haptics.selection();
      navigation.navigate(routeName);
    }
  };

  const scrimHeight = bottomOffset + BAR_H + STRIP + SCRIM_EXTRA;

  const fabIndex = state.routes.findIndex((r) => r.name === 'NewJob');
  const fabRoute = fabIndex >= 0 ? state.routes[fabIndex] : undefined;
  const fabFocused = state.index === fabIndex;

  // Tabs are flex: 1 in a row of known width, so a slot's centre is pure
  // arithmetic; only the chip's own width has to be measured.
  const slotWidth = barW / Math.max(state.routes.length, 1);
  const chipWidth = Math.max(slotWidth - CHIP_MARGIN * 2, 0);
  const chipTargetX = state.index * slotWidth + CHIP_MARGIN;

  // -1 means "not measured yet" and holds the chip hidden, so it never paints a
  // frame at x=0 before the real geometry arrives.
  const x = useSharedValue(-1);
  const snappy = theme.motion.spring.snappy;

  React.useEffect(() => {
    if (chipWidth <= 0) return;
    if (x.value < 0) {
      x.value = chipTargetX; // first placement: no travel from nowhere
    } else {
      x.value = withSpring(chipTargetX, snappy);
    }
  }, [chipTargetX, chipWidth, x, snappy]);

  const chipStyle = useAnimatedStyle(() => ({
    // Hidden until measured, and while the FAB is the selected tab — the FAB is
    // its own indicator, so a chip parked under it would read as a second one.
    opacity: x.value < 0 || chipHeight <= 0 || fabFocused ? 0 : 1,
    transform: [{ translateX: Math.max(x.value, 0) }],
  }));

  const onMeasure = useCallback(
    (size: { height: number }) =>
      setChipHeight((prev) => (Math.abs(prev - size.height) < 1 ? prev : size.height)),
    [],
  );

  return (
    // Overlays the scenes — content scrolls behind the floating bar; screens
    // pad their scroll body with useTabBarSpace() so nothing rests hidden.
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
          bottom: bottomOffset,
          height: BAR_H + STRIP,
        }}
      >
        {/* Notched bar background */}
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: -SHADOW_PAD, top: STRIP - SHADOW_PAD }}
        >
          <Svg width={barW + SHADOW_PAD * 2} height={BAR_H + SHADOW_PAD * 2}>
            <Defs>
              {/* The default filter region clips at 110% of the bounding box,
                which would cut a 7px blur off. */}
              <Filter id="driverBarShadow" x="-25%" y="-25%" width="150%" height="150%">
                <FeDropShadow
                  dx="0"
                  dy={SHADOW_DY}
                  stdDeviation={SHADOW_STD}
                  floodColor="#000000"
                  floodOpacity={SHADOW_OPACITY}
                />
              </Filter>
            </Defs>
            {/* One path: FeDropShadow emits the shadow beneath the source, so the
              bar and its shadow come from the same geometry and cannot drift. */}
            <Path
              d={barPath(barW, SHADOW_PAD, SHADOW_PAD)}
              fill={theme.colors.tabBarBg}
              fillRule="evenodd"
              filter="url(#driverBarShadow)"
            />
          </Svg>
        </View>

        {/* Tab items (center slot left empty for the FAB) */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: STRIP,
            width: barW,
            height: BAR_H,
            flexDirection: 'row',
          }}
        >
          {/* Declared first so it paints behind the items. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: (BAR_H - chipHeight) / 2,
                width: chipWidth,
                height: chipHeight,
                // ~0.29 of the height, matching the reference. Derived from the
                // measured height rather than hardcoded, so it stays right when
                // the OS font scale changes the label's line height.
                borderRadius: Math.round(chipHeight * CHIP_RADIUS_RATIO),
                backgroundColor: ACTIVE_CHIP,
              },
              chipStyle,
            ]}
          />

          {state.routes.map((route, index) => {
            if (route.name === 'NewJob') {
              return <View key={route.key} style={{ flex: 1 }} />;
            }
            const focused = state.index === index;
            return (
              <TabItem
                key={route.key}
                routeName={route.name}
                focused={focused}
                onPress={() => handlePress(route.name, route.key, focused)}
                onMeasure={onMeasure}
              />
            );
          })}
        </View>

        {/* FAB nested in the notch + its label */}
        {fabRoute ? (
          <View
            pointerEvents="box-none"
            style={{ position: 'absolute', left: 0, top: 0, width: barW, alignItems: 'center' }}
          >
            <Pressable
              onPress={() => handlePress(fabRoute.name, fabRoute.key, fabFocused)}
              // Scale, not alpha: the circle below carries elevation, and on
              // Android an elevation shadow is drawn outside its own view's alpha,
              // so fading this would leave the shadow behind.
              pressScale={theme.motion.pressScale.button}
              haptic="medium"
              accessibilityRole="button"
              accessibilityState={{ selected: fabFocused }}
              accessibilityLabel={TAB_LABELS.NewJob}
              style={{ alignItems: 'center' }}
            >
              <View
                style={{
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  borderRadius: FAB_SIZE / 2,
                  backgroundColor: driverColors.gold,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.18,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                {/* Figma's icon spans ~62% of the FAB diameter. */}
                <TowTruckIcon width={FAB_SIZE * 0.62} />
              </View>
              <Text
                weight={fabFocused ? 'semibold' : 'medium'}
                style={{
                  fontSize: 12,
                  marginTop: 11,
                  color: fabFocused ? driverColors.accent : '#171717',
                }}
              >
                {TAB_LABELS.NewJob}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}
