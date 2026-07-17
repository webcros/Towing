import React from 'react';
import {
  RefreshControl,
  ScrollView,
  View,
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
  /** Rendered above the scroll body (e.g. a persistent OfflineBanner). */
  banner?: React.ReactNode;
  /** Pinned below the body (e.g. a sticky CTA). */
  footer?: React.ReactNode;
  background?: 'surface0' | 'card';
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  scroll = false,
  edges = ['top'],
  refreshing,
  onRefresh,
  banner,
  footer,
  background = 'surface0',
  contentContainerStyle,
}: ScreenProps) {
  const theme = useTheme();
  const backgroundColor = background === 'card' ? theme.colors.card : theme.colors.surface0;

  const body = scroll ? (
    <ScrollView
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
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentContainerStyle]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor }}>
      {banner}
      {body}
      {footer}
    </SafeAreaView>
  );
}
