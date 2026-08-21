import React from 'react';
import { View } from 'react-native';
import type { NotificationDto } from '@towing/api-contracts';
import { Text } from '@towing/ui';
import { useTheme } from '@towing/theme';
import { formatRelativeTime } from '@/utils/format';

/**
 * One row of the bell.
 *
 * Unread is carried by a dot and a weight change, not by a tinted background:
 * a full-bleed tint across a list of mostly-unread rows reads as an error
 * state, and the §12.2 rows are ordinary information.
 */
export function NotificationRow({ notification }: { notification: NotificationDto }) {
  const theme = useTheme();
  const unread = notification.readAt === null;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: theme.colors.surface0,
      }}
      accessibilityRole="text"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${notification.title}. ${notification.body}`}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          marginTop: 6,
          backgroundColor: unread ? theme.colors.brand : 'transparent',
        }}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
          <Text variant="body" weight={unread ? 'semibold' : 'regular'} style={{ flex: 1 }}>
            {notification.title}
          </Text>
          <Text variant="caption" color="secondary">
            {formatRelativeTime(notification.createdAt)}
          </Text>
        </View>
        <Text variant="caption" color="secondary">
          {notification.body}
        </Text>
      </View>
    </View>
  );
}
