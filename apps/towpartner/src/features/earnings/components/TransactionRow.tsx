import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@towing/ui';
import { Check, Gift } from '@/icons';
import { IconChip } from '@/components/IconChip';
import { driverColors } from '@/theme/driverColors';
import { formatINR } from '@/utils/format';
import type { Transaction } from '../types';

/** One row in the Earnings "Recent Transactions" list (no chevron — calmer). */
export function TransactionRow({ tx, onPress }: { tx: Transaction; onPress?: () => void }) {
  const isBonus = tx.kind === 'bonus';
  const statusColor = isBonus ? driverColors.chip.purple.fg : driverColors.online;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tx.title}, ${formatINR(tx.amount)}, ${tx.statusLabel}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <IconChip icon={isBonus ? Gift : Check} tone={isBonus ? 'purple' : 'green'} size={40} iconSize={18} />

      <View style={{ flex: 1 }}>
        <Text weight="medium" numberOfLines={1} style={{ fontSize: 15, lineHeight: 21 }}>
          {tx.title}
        </Text>
        <Text color="secondary" numberOfLines={1} style={{ fontSize: 13, lineHeight: 18 }}>
          {tx.dateTimeLabel}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text weight="medium" tabular style={{ fontSize: 15, lineHeight: 21 }}>
          {formatINR(tx.amount)}
        </Text>
        <Text style={{ fontSize: 12, lineHeight: 16, color: statusColor }}>{tx.statusLabel}</Text>
      </View>
    </Pressable>
  );
}
