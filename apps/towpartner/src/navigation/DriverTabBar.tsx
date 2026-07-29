import React from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { Home, ClipboardList, Wallet, User, TowTruckIcon } from '@/icons';
import { driverColors } from '@/theme/driverColors';

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
const RADIUS = 26;
const NOTCH_R = 33;
const NOTCH_CY = 10;
const FAB_SIZE = 58;
/** Transparent strip above the bar that the FAB pokes into. */
const STRIP = FAB_SIZE / 2 - NOTCH_CY + 1;

const INACTIVE = '#374151';

/**
 * Clearance scroll content needs so its last items can rest above the
 * floating bar (bar + FAB strip + bottom margin + breathing room).
 */
export function useTabBarSpace(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 10) + BAR_H + STRIP + 12;
}

/** Rounded-rect bar with a circular notch cut out (evenodd fill rule). */
function barPath(w: number): string {
  const r = RADIUS;
  const cx = w / 2;
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `A ${r} ${r} 0 0 1 ${w} ${r}`,
    `V ${BAR_H - r}`,
    `A ${r} ${r} 0 0 1 ${w - r} ${BAR_H}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${BAR_H - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
    `M ${cx - NOTCH_R} ${NOTCH_CY}`,
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${cx + NOTCH_R} ${NOTCH_CY}`,
    `A ${NOTCH_R} ${NOTCH_R} 0 1 0 ${cx - NOTCH_R} ${NOTCH_CY}`,
    'Z',
  ].join(' ');
}

/**
 * Driver bottom nav (Figma 62:175) — a floating rounded bar with a true
 * cut-out notch holding the gold "New Job" FAB; active tab = orange.
 */
export function DriverTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const barW = width - H_MARGIN * 2;

  const handlePress = (routeName: string, routeKey: string, focused: boolean) => {
    const event = navigation.emit({ type: 'tabPress', target: routeKey, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const fabIndex = state.routes.findIndex((r) => r.name === 'NewJob');
  const fabRoute = fabIndex >= 0 ? state.routes[fabIndex] : undefined;
  const fabFocused = state.index === fabIndex;

  return (
    // Overlays the scenes — content scrolls behind the floating bar; screens
    // pad their scroll body with useTabBarSpace() so nothing rests hidden.
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: H_MARGIN,
        right: H_MARGIN,
        bottom: Math.max(insets.bottom, 10),
        height: BAR_H + STRIP,
      }}
    >
      {/* Notched bar background */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: 0,
          top: STRIP,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.07,
          shadowRadius: 16,
        }}
      >
        <Svg width={barW} height={BAR_H}>
          <Path d={barPath(barW)} fill={theme.colors.tabBarBg} fillRule="evenodd" />
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
        {state.routes.map((route, index) => {
          if (route.name === 'NewJob') {
            return <View key={route.key} style={{ flex: 1 }} />;
          }
          const focused = state.index === index;
          const color = focused ? driverColors.accent : INACTIVE;
          const label = TAB_LABELS[route.name] ?? route.name;
          const Icon = TAB_ICONS[route.name] ?? Home;
          return (
            <Pressable
              key={route.key}
              onPress={() => handlePress(route.name, route.key, focused)}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingTop: 26,
                gap: 4,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon size={20} color={color} strokeWidth={focused ? 2.4 : 2} />
              <Text weight={focused ? 'semibold' : 'medium'} style={{ fontSize: 12, color }}>
                {label}
              </Text>
            </Pressable>
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
            accessibilityRole="button"
            accessibilityState={{ selected: fabFocused }}
            accessibilityLabel={TAB_LABELS.NewJob}
            style={({ pressed }) => ({ alignItems: 'center', opacity: pressed ? 0.85 : 1 })}
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
              style={{ fontSize: 12, marginTop: 11, color: fabFocused ? driverColors.accent : '#171717' }}
            >
              {TAB_LABELS.NewJob}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
