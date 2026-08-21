import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Skeleton } from '@towing/ui';
import { ROW_GAP } from '@/components/DetailRow';

/**
 * §9.1.5's "computing fare (skeleton rows)" state, and §10.8's "skeletons,
 * never spinners".
 *
 * Mirrors `FareBreakdownSheet`'s real layout rather than showing generic bars,
 * the same way `BookingDetailSkeleton` mirrors the booking detail: a skeleton
 * whose shape does not match what replaces it produces a visible jump at the
 * moment the data lands, which is the opposite of what it is for.
 *
 * Four rows because that is the common case — base plus one or two surcharges
 * plus the total.
 */
export function FareBreakdownSkeleton() {
  const theme = useTheme();

  return (
    <View accessibilityLabel="Computing fare">
      {[0, 1, 2].map((row) => (
        <View
          key={row}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: ROW_GAP,
            paddingVertical: 14,
          }}
        >
          <Skeleton width={row === 0 ? 96 : 128} height={14} radius={theme.radii.input} />
          <Skeleton width={72} height={14} radius={theme.radii.input} />
        </View>
      ))}

      {/* The total is heavier in the real sheet, so its bone is too. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: ROW_GAP,
          paddingVertical: 14,
          borderTopWidth: 1,
          borderTopColor: theme.colors.divider,
        }}
      >
        <Skeleton width={110} height={16} radius={theme.radii.input} />
        <Skeleton width={88} height={18} radius={theme.radii.input} />
      </View>
    </View>
  );
}
