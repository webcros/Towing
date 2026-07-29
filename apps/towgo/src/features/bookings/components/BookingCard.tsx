import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Divider, Skeleton, StatusBadge } from '@towing/ui';
import { Star } from '@/icons';
import { formatINR } from '@/utils/format';
import { STATUS_META } from '../statusMeta';
import { RouteTimeline } from './RouteTimeline';
import { DateTime } from './DateTime';
import type { Booking } from '../types';

export function BookingCard({ booking, onPress }: { booking: Booking; onPress?: () => void }) {
  const theme = useTheme();
  const status = STATUS_META[booking.status];

  return (
    <View style={{ position: 'relative' }}>
      <Card
        radius="sheet"
        padding={18}
        onPress={onPress}
        accessibilityLabel={`${booking.originLabel} to ${booking.destinationLabel}, ${status.label}, ${formatINR(booking.fare)}`}
        style={{ gap: 18 }}
      >
        {/* Route timeline + trip info */}
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <RouteTimeline tone={booking.routeTone} />
          <View style={{ flex: 1, paddingLeft: 14, minHeight: 74, justifyContent: 'space-between' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <Text
                weight="semibold"
                numberOfLines={1}
                style={{ fontSize: 16, lineHeight: 20, flexShrink: 1 }}
              >
                {booking.originLabel}
              </Text>
              <DateTime date={booking.date} time={booking.time} />
            </View>

            <Text
              color="secondary"
              numberOfLines={1}
              style={{ fontSize: 12, lineHeight: 18, marginTop: 8 }}
            >
              to {booking.destinationLabel}
            </Text>
          </View>
        </View>

        <Divider />

        {/* Truck + driver + amount */}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
            <Image source={booking.truckImage} resizeMode="contain" style={{ width: 90, height: 56 }} />
            <View style={{ flex: 1 }}>
              <Text weight="semibold" numberOfLines={1} style={{ fontSize: 15, lineHeight: 22 }}>
                {booking.vehiclePlate}
              </Text>
              <Text color="secondary" numberOfLines={1} style={{ fontSize: 14, lineHeight: 21 }}>
                {booking.driverName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                <Star size={15} color={theme.colors.star} fill={theme.colors.star} />
                <Text tabular style={{ fontSize: 13, lineHeight: 19.5 }}>
                  {booking.driverRating.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text color="tertiary" style={{ fontSize: 13, lineHeight: 19.5 }}>
              Amount
            </Text>
            <Text weight="semibold" tabular style={{ fontSize: 17, lineHeight: 25.5 }}>
              {formatINR(booking.fare)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Floating status badge — pokes above the top-right corner (Figma). */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -10, right: 6 }}>
        <StatusBadge label={status.label} tone={status.tone} />
      </View>
    </View>
  );
}

export function BookingCardSkeleton() {
  return (
    <Card radius="sheet" padding={18} style={{ gap: 18 }}>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <Skeleton width={14} height={70} radius={7} />
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: 70 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width="45%" height={16} />
            <Skeleton width={70} height={12} />
          </View>
          <Skeleton width="55%" height={12} />
        </View>
      </View>
      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Skeleton width={90} height={56} radius={8} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="60%" height={14} />
          <Skeleton width="45%" height={12} />
        </View>
        <Skeleton width={50} height={30} radius={6} />
      </View>
    </Card>
  );
}
