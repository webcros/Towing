import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsDataSource } from './notificationsDataSource';
import { notificationKeys } from './notifications.keys';

/** The driver's notification centre feed (§12.1) — the bell in `DriverHeader`. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam }) => notificationsDataSource.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * The bell's dot. Separate from the list so the six screens that render
 * `DriverHeader` share one cheap cache entry instead of loading a page each.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => notificationsDataSource.unreadCount(),
    staleTime: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) => notificationsDataSource.markRead(ids),
    onSuccess: (result) => {
      queryClient.setQueryData(notificationKeys.unread(), { unread: result.unread });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}
