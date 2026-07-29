import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Divider, Skeleton } from '@towing/ui';

function CardBox({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        gap: 14,
        ...theme.shadows.card,
      }}
    >
      {children}
    </View>
  );
}

/** First-paint placeholder mirroring the trip / driver / summary boxes. */
export function BookingDetailSkeleton() {
  return (
    <View style={{ gap: 16 }}>
      <CardBox>
        <View style={{ flexDirection: 'row', gap: 14 }}>
          <Skeleton width={14} height={74} radius={7} />
          <View style={{ flex: 1, justifyContent: 'space-between', minHeight: 74 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width={70} height={12} />
            </View>
            <Skeleton width="60%" height={16} />
          </View>
        </View>
        <Divider />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <Skeleton width={44} height={44} radius={22} />
              <Skeleton width="70%" height={11} />
              <Skeleton width="55%" height={12} />
            </View>
          ))}
        </View>
      </CardBox>

      <Skeleton width={130} height={17} />
      <CardBox>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Skeleton width={64} height={64} radius={32} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton width="55%" height={15} />
            <Skeleton width="40%" height={12} />
            <Skeleton width="45%" height={12} />
          </View>
          <View style={{ gap: 10 }}>
            <Skeleton width={44} height={44} radius={22} />
            <Skeleton width={44} height={44} radius={22} />
          </View>
        </View>
      </CardBox>

      <Skeleton width={150} height={17} />
      <CardBox>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Skeleton width={20} height={20} radius={6} />
            <Skeleton width="40%" height={13} />
            <View style={{ flex: 1 }} />
            <Skeleton width={70} height={13} />
          </View>
        ))}
      </CardBox>
    </View>
  );
}
