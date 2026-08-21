import React, { useCallback } from 'react';
import { FlatList, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { EmptyState, ErrorState, Screen, Skeleton, Text } from '@towing/ui';
import { Bell, RefreshCw } from '@/icons';
import { DriverHeader } from '@/components/DriverHeader';
import { Pressable } from '@/motion';
import { track } from '@/lib/analytics/analytics';
import { NotificationRow } from '@/features/notifications/components/NotificationRow';
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/api/notifications.queries';

/**
 * The driver's in-app notification centre (§12.1).
 *
 * Until Phase 13 the bell in `DriverHeader` navigated here and got a
 * `PlaceholderScreen`.
 *
 * Reads `notifications` rows, never delivery receipts (invariant 74): a KYC
 * decision that reached no push token — because the driver denied the
 * permission, or because no Firebase project exists yet — still has to be
 * readable here. That is what makes the §9.4.3 chain demonstrable before any
 * vendor credential lands.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const query = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkNotificationsRead();

  React.useEffect(() => {
    track('notification_opened');
  }, []);

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const hasUnread = (unread.data?.unread ?? 0) > 0;

  const onEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  return (
    <Screen>
      <DriverHeader
        title="Notifications"
        leading="back"
        onLeading={() => navigation.goBack()}
        showBell={false}
      />

      {hasUnread ? (
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 }}>
          <Pressable
            onPress={() => markRead.mutate(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            <Text variant="caption" style={{ color: theme.colors.brand }}>
              Mark all read
            </Text>
          </Pressable>
        </View>
      ) : null}

      {query.isPending ? (
        <View style={{ paddingHorizontal: 16, gap: 12 }}>
          <Skeleton width="100%" height={72} radius={12} />
          <Skeleton width="100%" height={72} radius={12} />
          <Skeleton width="100%" height={72} radius={12} />
        </View>
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load notifications"
          onRetry={() => void query.refetch()}
          icon={RefreshCw}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here yet"
          body="Verification updates, job alerts and payout confirmations will show up here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: 36 }} />
          )}
          onEndReachedThreshold={0.5}
          onEndReached={onEndReached}
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
        />
      )}
    </Screen>
  );
}
