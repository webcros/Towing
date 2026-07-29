import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, Divider, StatusBadge } from '@towing/ui';
import { Truck, Clock, Receipt } from '@/icons';
import { StatColumn } from '@/components/StatColumn';
import { formatEta, formatINR } from '@/utils/format';
import { STATUS_META } from '../statusMeta';
import { RouteTimeline } from './RouteTimeline';
import { DateTime } from './DateTime';
import type { BookingDetail } from '../types';

function LocationRow({
  label,
  value,
  right,
}: {
  label: string;
  value: string;
  right: React.ReactNode;
}) {
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Text color="secondary" style={{ fontSize: 12, lineHeight: 16 }}>
          {label}
        </Text>
        <Text weight="semibold" numberOfLines={2} style={{ fontSize: 15, lineHeight: 20 }}>
          {value}
        </Text>
      </View>
      {/* Content-width wrapper — StatusBadge hardcodes alignSelf:'flex-start'. */}
      <View style={{ flexShrink: 0, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

/** Pickup → drop with the at-a-glance tow type / duration / total row. */
export function BookingTripCard({ booking, towName }: { booking: BookingDetail; towName: string }) {
  const theme = useTheme();
  const status = STATUS_META[booking.status];

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
      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <RouteTimeline tone={booking.routeTone} />
        <View style={{ flex: 1, paddingLeft: 14, gap: 18 }}>
          <LocationRow
            label="Pickup Location"
            value={booking.originLabel}
            right={
              <DateTime
                date={booking.date}
                time={booking.time}
                showIcons={false}
                align="flex-end"
                emphasizeDate
              />
            }
          />
          <LocationRow
            label="Drop Location"
            value={booking.destinationLabel}
            right={<StatusBadge label={status.label} tone={status.tone} />}
          />
        </View>
      </View>

      <Divider />

      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <StatColumn icon={Truck} label="Tow Type" value={towName} />
        <Divider vertical inset={2} />
        <StatColumn icon={Clock} label="Duration" value={formatEta(booking.durationMinutes)} tabular />
        <Divider vertical inset={2} />
        <StatColumn icon={Receipt} label="Total Amount" value={formatINR(booking.fare)} tabular />
      </View>
    </View>
  );
}
