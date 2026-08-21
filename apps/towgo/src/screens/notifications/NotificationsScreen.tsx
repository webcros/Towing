import React from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Bell } from '@/icons';
import { EmptyState, ErrorState, Text } from '@towing/ui';
import { useTheme } from '@towing/theme';
import { SubScreen } from '@/components/SubScreen';
import { track } from '@/lib/analytics/analytics';
import { NotificationRow } from '@/features/notifications/components/NotificationRow';
import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/api/notifications.queries';

/**
 * The in-app notification centre (§12.1) — what the bell in `AppHeader` opens.
 *
 * Until Phase 13 that bell's `onPress` was documented as doing nothing.
 *
 * The list reads `notifications` rows, never delivery receipts (invariant 74):
 * a message that reached no push token, went out on the log adapter, or was
 * aimed at a revoked device still belongs here. That is what makes the whole
 * spine demonstrable before any vendor credential exists.
 */
export function NotificationsScreen() {
  const theme = useTheme();
  const query = useNotifications();
  const unread = useUnreadCount();
  const markRead = useMarkNotificationsRead();

  React.useEffect(() => {
    track('notification_opened');
  }, []);

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];
  const hasUnread = (unread.data?.unread ?? 0) > 0;

  return (
    <SubScreen
      title="Notifications"
      right={
        hasUnread ? (
          <Text
            variant="caption"
            color="brand"
            onPress={() => markRead.mutate(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
          >
            Mark all read
          </Text>
        ) : undefined
      }
      gap={0}
    >
      {query.isPending ? (
        <View style={{ paddingVertical: 48, alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.brand} />
        </View>
      ) : query.isError ? (
        <ErrorState
          title="Could not load notifications"
          body="Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Nothing here yet"
          body="Booking updates, driver arrivals and receipts will show up here."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <NotificationRow notification={item} />}
          ItemSeparatorComponent={() => (
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginLeft: 36 }} />
          )}
          scrollEnabled={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
          }}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color={theme.colors.brand} />
              </View>
            ) : null
          }
        />
      )}
    </SubScreen>
  );
}
