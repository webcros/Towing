import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, StatusBadge, Text } from '@towing/ui';
import { ChevronRight } from '@/icons';
import { formatPaise } from '@/utils/format';
import { SCHEDULED_META, STATUS_META } from '../statusMeta';
import { isScheduled, type Booking } from '../types';
import { RouteTimeline } from './RouteTimeline';

/**
 * §9.1.10's "active trip card".
 *
 * THE THING THIS FIXES: before Phase 15 an in-flight trip existed only on the
 * tracking screen. Leave it — background the app, tap the back gesture, open a
 * notification — and there was no route back. Nothing in the bookings list, the
 * home screen or anywhere else knew a trip was running, because every mocked
 * booking was `completed`.
 *
 * Deliberately louder than a `BookingCard`: brand-tinted, at the top of the
 * list, and it names what is happening rather than a status word. A customer
 * whose car is on a hook should not have to look for it.
 */
export function ActiveTripCard({ booking, onPress }: { booking: Booking; onPress: () => void }) {
  const theme = useTheme();
  const status = STATUS_META[booking.status];
  const scheduled = isScheduled(booking);

  return (
    <Card
      radius="sheet"
      padding={theme.spacing.lg}
      onPress={onPress}
      accessibilityLabel={`Current trip, ${status.label}, ${booking.originLabel} to ${booking.destinationLabel}`}
      style={{
        gap: theme.spacing.md,
        backgroundColor: theme.colors.brandTint,
        borderColor: theme.colors.brand,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="overline" weight="semibold" style={{ flex: 1 }}>
          {scheduled ? 'Scheduled trip' : 'Current trip'}
        </Text>
        <StatusBadge
          label={scheduled ? SCHEDULED_META.label : status.label}
          tone={scheduled ? SCHEDULED_META.tone : status.tone}
          pill
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <RouteTimeline tone={booking.routeTone} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="subtitle" numberOfLines={1}>
            {booking.originLabel}
          </Text>
          <Text variant="caption" color="secondary" numberOfLines={1}>
            to {booking.destinationLabel}
          </Text>
        </View>
        <ChevronRight size={20} color={theme.colors.textTertiary} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="caption" color="secondary" style={{ flex: 1 }}>
          {booking.driverName
            ? `${booking.driverName}${booking.vehiclePlate ? ` · ${booking.vehiclePlate}` : ''}`
            : // §11.9 forbids driver identity before assignment, so this is the
              // honest copy for the whole search — not a placeholder.
              'Finding you a driver'}
        </Text>
        <Text variant="subtitle" tabular>
          {formatPaise(booking.farePaise)}
        </Text>
      </View>
    </Card>
  );
}
