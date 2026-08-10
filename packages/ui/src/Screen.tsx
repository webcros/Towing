import React from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@towing/theme';

export type ScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: readonly Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Rendered above everything (e.g. a persistent OfflineBanner). */
  banner?: React.ReactNode;
  /**
   * Fixed bar between the banner and the scroll body. Unlike a header placed
   * inside `children`, this one does not scroll away — which is what lets a
   * caller drive it from scroll position.
   */
  header?: React.ReactNode;
  /** Pinned below the body (e.g. a sticky CTA). */
  footer?: React.ReactNode;
  background?: 'surface0' | 'card';
  contentContainerStyle?: StyleProp<ViewStyle>;
  /**
   * Scroll implementation. Defaults to RN's ScrollView; an app that wants
   * scroll-linked motion passes its animation library's equivalent. Kept as a
   * plain component type so this package needs no animation dependency of its
   * own — see PressableSlot for the same pattern applied to Pressable.
   */
  ScrollComponent?: React.ComponentType<ScrollViewProps>;
  /**
   * Spread onto the scroller *after* the built-in props, so a caller can supply
   * `onScroll` / `scrollEventThrottle` / `ref` or override any default.
   */
  scrollProps?: Partial<ScrollViewProps>;
};

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  refreshing,
  onRefresh,
  banner,
  header,
  footer,
  background = 'surface0',
  contentContainerStyle,
  ScrollComponent = ScrollView,
  scrollProps,
}: ScreenProps) {
  const theme = useTheme();
  const backgroundColor = background === 'card' ? theme.colors.card : theme.colors.surface0;

  const body = scroll ? (
    <ScrollComponent
      style={{ flex: 1 }}
      contentContainerStyle={[{ flexGrow: 1 }, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.brand}
            colors={[theme.colors.brand]}
          />
        ) : undefined
      }
      {...scrollProps}
    >
      {children}
    </ScrollComponent>
  ) : (
    <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor }}>
      {banner}
      {header}
      {body}
      {footer}
    </SafeAreaView>
  );
}
