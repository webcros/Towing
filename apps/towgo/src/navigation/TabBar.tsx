import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { Home, ClipboardList, Wrench, User } from '@/icons';

const TAB_ICONS: Record<string, IconComponent> = {
  Home,
  Bookings: ClipboardList,
  Services: Wrench,
  Profile: User,
};

/** Custom bottom nav matching the Figma design — rounded top, active = amber. */
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: theme.colors.tabBarBg,
        paddingTop: 10,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingHorizontal: theme.spacing.md,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        // Single soft upward lift (Figma: 0 -10.9 20.4 rgba(0,0,0,0.06)).
        // No top border, and light elevation — a heavy shadow read as a
        // "line + second background" behind the bar.
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 6,
      }}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const Icon = TAB_ICONS[route.name] ?? Home;
        const color = focused ? theme.colors.tabActive : theme.colors.tabInactive;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={route.name}
            style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 4 }}
          >
            <Icon size={22} color={color} strokeWidth={focused ? 2.4 : 2} />
            <Text
              variant="micro"
              weight={focused ? 'semibold' : 'medium'}
              style={{ color, fontSize: 10 }}
            >
              {route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
