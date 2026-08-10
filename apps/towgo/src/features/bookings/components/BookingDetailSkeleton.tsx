import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Skeleton } from '@towing/ui';
import { ROW_GAP, ROW_GUTTER, RowDivider } from '@/components/DetailRow';

/** One flat row: icon slug, label, right-aligned value. */
function RowBone({ valueWidth = 70 }: { valueWidth?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: ROW_GAP,
        paddingVertical: 14,
      }}
    >
      <View style={{ width: ROW_GUTTER, alignItems: 'center' }}>
        <Skeleton width={theme.sizes.icon.lg} height={theme.sizes.icon.lg} radius={5} />
      </View>
      <Skeleton width="38%" height={14} />
      <View style={{ flex: 1 }} />
      <Skeleton width={valueWidth} height={14} />
    </View>
  );
}

/** First-paint placeholder for the flat details list. */
export function BookingDetailSkeleton() {
  const theme = useTheme();

  return (
    <View style={{ gap: 28 }}>
      {/* Title + reference */}
      <View style={{ gap: theme.spacing.xs }}>
        <Skeleton width="62%" height={30} radius={8} />
        <Skeleton width={120} height={13} />
      </View>

      {/* Hero: heading, meta, fare, avatar, status, actions */}
      <View style={{ gap: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg }}>
          <View style={{ flex: 1, gap: theme.spacing.sm }}>
            <Skeleton width="90%" height={24} radius={7} />
            <Skeleton width="55%" height={14} />
            <Skeleton width={90} height={20} radius={6} />
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Skeleton
              width={theme.sizes.avatar.md}
              height={theme.sizes.avatar.md}
              radius={theme.sizes.avatar.md / 2}
            />
            <Skeleton width={34} height={13} />
          </View>
        </View>
        <Skeleton width={104} height={26} radius={theme.radii.pill} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <Skeleton
            width="48%"
            height={theme.sizes.control.tapTarget}
            radius={theme.radii.pill}
          />
          <Skeleton
            width="48%"
            height={theme.sizes.control.tapTarget}
            radius={theme.radii.pill}
          />
        </View>
      </View>

      {/* Route + trip facts */}
      <View>
        <RowDivider />
        <RowBone valueWidth={58} />
        <RowBone valueWidth={58} />
        <RowDivider />
        {[0, 1, 2, 3, 4].map((i) => (
          <React.Fragment key={i}>
            <RowBone />
            <RowDivider />
          </React.Fragment>
        ))}
      </View>

      {/* Help & support */}
      <View style={{ gap: theme.spacing.sm }}>
        <Skeleton width="46%" height={24} radius={7} />
        <View style={{ flexDirection: 'row', gap: ROW_GAP, paddingVertical: theme.spacing.md }}>
          <Skeleton width={theme.sizes.icon.lg} height={theme.sizes.icon.lg} radius={5} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="42%" height={14} />
            <Skeleton width="70%" height={13} />
          </View>
        </View>
      </View>
    </View>
  );
}
