import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { Check, Clock, ArrowRight } from '@/icons';
import { IconChip } from '@/components/IconChip';
import { driverColors } from '@/theme/driverColors';
import { formatINR } from '@/utils/format';
import type { RecentJob } from '../types';

/**
 * One row in the Home "Recent Activity" list. No trailing chevron — the whole
 * row is tappable and the extra glyph only crowded the fare column.
 */
export function RecentActivityRow({ item, onPress }: { item: RecentJob; onPress?: () => void }) {
  const theme = useTheme();
  const completed = item.status === 'completed';
  const statusColor = completed ? driverColors.online : driverColors.accent;
  const statusLabel = completed ? 'Completed' : 'Cancelled';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.vehicleName}, ${statusLabel}, ${formatINR(item.fare)}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <IconChip
        icon={completed ? Check : Clock}
        tone={completed ? 'green' : 'orange'}
        size={40}
        iconSize={17}
      />

      <View style={{ flex: 1 }}>
        <Text weight="medium" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>
          {item.vehicleName}
        </Text>
        <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 19 }}>
          {item.pickup}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
          <ArrowRight size={11} color={theme.colors.textSecondary} strokeWidth={2.4} />
          <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 19, flex: 1 }}>
            {item.drop}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text weight="medium" tabular style={{ fontSize: 15, lineHeight: 21 }}>
          {formatINR(item.fare)}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 17, color: statusColor }}>{statusLabel}</Text>
      </View>
    </Pressable>
  );
}
