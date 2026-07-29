import React from 'react';
import { View } from 'react-native';
import { useTheme, type Theme } from '@towing/theme';
import { Text, Divider, type IconComponent } from '@towing/ui';
import { Calendar, Clock, Route, IndianRupee, Receipt, ShieldCheck, CircleX } from '@/icons';
import { formatINR } from '@/utils/format';
import { STATUS_NOTE } from '../statusMeta';
import type { BookingDetail, BookingPaymentMethod, BookingStatus } from '../types';

const PAYMENT_LABEL: Record<BookingPaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  upi: 'UPI',
  wallet: 'Wallet',
};

function noteColors(status: BookingStatus, theme: Theme): { bg: string; fg: string } {
  switch (status) {
    case 'completed':
      return { bg: theme.colors.successSoftBg, fg: theme.colors.successSoftFg };
    case 'cancelled':
      return { bg: theme.colors.errorSoftBg, fg: theme.colors.errorSoftFg };
    default:
      return { bg: theme.colors.infoSoftBg, fg: theme.colors.infoSoftFg };
  }
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  tabular,
}: {
  icon: IconComponent;
  label: string;
  value: string;
  tabular?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 }}
    >
      <View style={{ width: 24, alignItems: 'center' }}>
        <Icon size={20} color={theme.colors.textSecondary} strokeWidth={1.9} />
      </View>
      <Text color="secondary" style={{ flex: 1, fontSize: 14, lineHeight: 19 }}>
        {label}
      </Text>
      <Text weight="semibold" tabular={tabular} style={{ fontSize: 14.5, lineHeight: 20 }}>
        {value}
      </Text>
    </View>
  );
}

/** Label/value breakdown plus a status-coloured closing note. */
export function BookingSummaryCard({ booking }: { booking: BookingDetail }) {
  const theme = useTheme();
  const note = noteColors(booking.status, theme);
  const NoteIcon = booking.status === 'cancelled' ? CircleX : ShieldCheck;

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
        ...theme.shadows.card,
      }}
    >
      <SummaryRow icon={Calendar} label="Booking Date" value={booking.date} />
      <Divider />
      <SummaryRow icon={Clock} label="Booking Time" value={booking.time} />
      <Divider />
      <SummaryRow icon={Route} label="Distance" value={`${booking.distanceKm} km`} tabular />
      <Divider />
      <SummaryRow
        icon={IndianRupee}
        label="Payment Method"
        value={PAYMENT_LABEL[booking.paymentMethod]}
      />
      <Divider />
      <SummaryRow icon={Receipt} label="Total Amount" value={formatINR(booking.fare)} tabular />

      <View
        style={{
          marginHorizontal: 14,
          marginTop: 4,
          marginBottom: 14,
          backgroundColor: note.bg,
          borderRadius: theme.radii.button,
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <NoteIcon size={18} color={note.fg} strokeWidth={2} />
        <Text weight="medium" style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: note.fg }}>
          {STATUS_NOTE[booking.status]}
        </Text>
      </View>
    </View>
  );
}
