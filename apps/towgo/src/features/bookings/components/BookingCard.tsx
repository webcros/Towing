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
        padding={theme.spacing.lg}
        onPress={onPress}
        accessibilityLabel={`${booking.originLabel} to ${booking.destinationLabel}, ${status.label}, ${formatINR(booking.fare)}`}
        style={{ gap: theme.spacing.lg }}
      >
        {/* Route timeline + trip info */}
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <RouteTimeline tone={booking.routeTone} />
          <View
            style={{
              flex: 1,
              paddingLeft: theme.spacing.lg,
              // Clears the timeline rail (dot 14 + 32 connector + 12 margins + pin 16).
              minHeight: 76,
              justifyContent: 'space-between',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: theme.spacing.lg,
              }}
            >
              <Text
                weight="semibold"
                numberOfLines={1}
                variant="subtitle"
                style={{ flexShrink: 1 }}
              >
                {booking.originLabel}
              </Text>
              <DateTime date={booking.date} time={booking.time} />
            </View>

            <Text
              variant="caption"
              color="secondary"
              numberOfLines={1}
              style={{ marginTop: theme.spacing.sm }}
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
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg, flex: 1 }}
          >
            <Image source={booking.truckImage} resizeMode="contain" style={{ width: 90, height: 56 }} />
            <View style={{ flex: 1 }}>
              <Text variant="subtitle" numberOfLines={1}>
                {booking.vehiclePlate}
              </Text>
              <Text
                color="secondary"
                numberOfLines={1}
                variant="body"
              >
                {booking.driverName}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <Star size={15} color={theme.colors.star} fill={theme.colors.star} />
                <Text variant="caption" tabular>
                  {booking.driverRating.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="caption" color="tertiary" style={{ marginBottom: 2 }}>
              Amount
            </Text>
            <Text variant="subtitle" tabular>
              {formatINR(booking.fare)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Floating status badge — pokes above the top-right corner (Figma). */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -10, right: 12 }}>
        <StatusBadge label={status.label} tone={status.tone} />
      </View>
    </View>
  );
}

export function BookingCardSkeleton() {
  const theme = useTheme();

  return (
    <Card radius="sheet" padding={theme.spacing.lg} style={{ gap: theme.spacing.lg }}>
      {/* gap matches RouteTimeline's 18px track + the card's 16px paddingLeft. */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.xl }}>
        <Skeleton width={14} height={76} radius={7} />
        <View style={{ flex: 1, justifyContent: 'space-between', minHeight: 76 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Skeleton width="45%" height={16} />
            <Skeleton width={70} height={12} />
          </View>
          <Skeleton width="55%" height={12} />
        </View>
      </View>
      <Divider />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
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
