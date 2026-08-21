import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '@towing/ui';
import { addMinutesToTimeLabel, formatBookingTime } from '@/utils/format';
import { ROW_GAP, ROW_GUTTER } from '@/components/DetailRow';
import type { BookingDetail, RouteTone } from '../types';

/** Small hollow ring for the origin, filled square for the destination —
 *  the same visual language as the map pins, at row scale. */
function OriginMarker({ tone }: { tone: RouteTone }) {
  const theme = useTheme();
  const color = tone === 'success' ? theme.colors.success : theme.colors.info;

  return (
    <View
      style={{
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 3,
        borderColor: color,
      }}
    />
  );
}

function DestinationMarker() {
  const theme = useTheme();
  return (
    <View
      style={{ width: 11, height: 11, borderRadius: 2, backgroundColor: theme.colors.error }}
    />
  );
}

function Stop({
  marker,
  address,
  time,
}: {
  marker: React.ReactNode;
  address: string;
  time: string;
}) {
  const theme = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: ROW_GAP,
        paddingVertical: theme.spacing.md,
      }}
    >
      <View style={{ width: ROW_GUTTER, alignItems: 'center', paddingTop: 4 }}>{marker}</View>
      <Text variant="body" numberOfLines={2} style={{ flex: 1 }}>
        {address}
      </Text>
      <Text variant="caption" color="secondary" align="right">
        {time}
      </Text>
    </View>
  );
}

/**
 * Pickup → drop as two flat rows joined by a dotted rail.
 *
 * The rail is absolutely positioned down the icon column so the two rows stay
 * independent — the previous version nested them in a relative box with a
 * hand-tuned 40dp spacer band, which is what made the block so tall.
 */
export function RouteRows({ booking }: { booking: BookingDetail }) {
  const theme = useTheme();

  return (
    <View style={{ position: 'relative' }}>
      {/* Rail: centred in the gutter, running between the two markers. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: ROW_GUTTER / 2 - 1,
          top: 30,
          bottom: 30,
          width: 2,
          borderRadius: 1,
          borderLeftWidth: 2,
          borderStyle: 'dashed',
          borderColor: theme.colors.border,
        }}
      />

      <Stop
        marker={<OriginMarker tone={booking.routeTone} />}
        address={booking.originLabel}
        time={formatBookingTime(booking.createdAt)}
      />
      <Stop
        marker={<DestinationMarker />}
        address={booking.destinationLabel}
        time={addMinutesToTimeLabel(formatBookingTime(booking.createdAt), booking.durationMinutes ?? 0)}
      />
    </View>
  );
}
