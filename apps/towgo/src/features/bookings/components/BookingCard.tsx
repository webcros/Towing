import React from 'react';
import { Image, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Text, Divider, Skeleton, StatusBadge } from '@towing/ui';
import { Star } from '@/icons';
import { formatBookingDate, formatBookingTime, formatPaise } from '@/utils/format';
import { SCHEDULED_META, STATUS_META } from '../statusMeta';
import { RouteTimeline } from './RouteTimeline';
import { DateTime } from './DateTime';
import { isScheduled, type Booking } from '../types';

export function BookingCard({ booking, onPress }: { booking: Booking; onPress?: () => void }) {
  const theme = useTheme();
  const status = STATUS_META[booking.status];

  return (
    <View style={{ position: 'relative' }}>
      <Card
        radius="sheet"
        padding={theme.spacing.lg}
        onPress={onPress}
        accessibilityLabel={`${booking.originLabel} to ${booking.destinationLabel}, ${status.label}, ${formatPaise(booking.farePaise)}`}
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
              <DateTime
                date={formatBookingDate(booking.createdAt)}
                time={formatBookingTime(booking.createdAt)}
              />
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
            {booking.truckImage ? (
              <Image
                source={{ uri: booking.truckImage }}
                resizeMode="contain"
                style={{ width: 90, height: 56 }}
              />
            ) : (
              // The backend has no truck-image pipeline yet, so this is the
              // normal case rather than an error state.
              <View
                style={{
                  width: 90,
                  height: 56,
                  borderRadius: theme.radii.input,
                  backgroundColor: theme.colors.surface1,
                }}
              />
            )}
            <View style={{ flex: 1 }}>
              {/*
                Driver identity is null until assignment — §11.9 forbids showing
                it before then, so a searching trip legitimately has no plate,
                no name and no rating.
              */}
              <Text variant="subtitle" numberOfLines={1}>
                {booking.vehiclePlate ?? 'Finding your driver'}
              </Text>
              {booking.driverName ? (
                <Text color="secondary" numberOfLines={1} variant="body">
                  {booking.driverName}
                </Text>
              ) : null}
              {booking.driverRating !== null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <Star size={15} color={theme.colors.star} fill={theme.colors.star} />
                  <Text variant="caption" tabular>
                    {booking.driverRating.toFixed(1)}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="caption" color="tertiary" style={{ marginBottom: 2 }}>
              Amount
            </Text>
            <Text variant="subtitle" tabular>
              {formatPaise(booking.farePaise)}
            </Text>
          </View>
        </View>
      </Card>

      {/* Floating status badge — pokes above the top-right corner (Figma). */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -10, right: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {isScheduled(booking) ? (
            <StatusBadge label={SCHEDULED_META.label} tone={SCHEDULED_META.tone} />
          ) : null}
          <StatusBadge label={status.label} tone={status.tone} />
        </View>
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
