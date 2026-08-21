import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SubjectNotificationPrefsUpdate } from '@towing/api-contracts';
import { notificationPrefsDataSource } from './notificationPrefsDataSource';
import { notificationPrefKeys } from './notificationPrefs.keys';
import { notificationsDataSource } from './notificationsDataSource';
import { notificationKeys } from './notifications.keys';

/** The centre's feed. Infinite because §12 notifications accumulate forever. */
export function useNotifications() {
  return useInfiniteQuery({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam }) => notificationsDataSource.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * The bell's dot. Kept separate from the list so the header can show it without
 * loading a page of notifications on every screen that renders a header.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: notificationKeys.unread(),
    queryFn: () => notificationsDataSource.unreadCount(),
    // A received push invalidates this directly; the interval is only the
    // fallback for a session where no push arrives (denied permission, Expo Go).
    staleTime: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids?: string[]) => notificationsDataSource.markRead(ids),
    onSuccess: (result) => {
      // Write the authoritative count straight in rather than refetching — the
      // server just told us, and a refetch would flicker the badge.
      queryClient.setQueryData(notificationKeys.unread(), { unread: result.unread });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
    },
  });
}

export function useNotificationPrefs() {
  return useQuery({
    queryKey: notificationPrefKeys.detail(),
    queryFn: () => notificationPrefsDataSource.get(),
  });
}

export function useUpdateNotificationPrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (patch: SubjectNotificationPrefsUpdate) =>
      notificationPrefsDataSource.update(patch),
    onSuccess: (prefs) => {
      queryClient.setQueryData(notificationPrefKeys.detail(), prefs);
    },
  });
}
