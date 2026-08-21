import React, { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, type IconComponent } from '@towing/ui';
import { Clock, User, ChevronDown } from '@/icons';
import { useBookingStore } from '../store/bookingStore';
import { formatBookingDate, formatBookingTime } from '@/utils/format';
import { SchedulePickerSheet } from './SchedulePickerSheet';
import { ContactSheet } from './BookingExtrasSheets';
import { Pressable } from '@/motion';

function Pill({
  icon: Icon,
  label,
  onPress,
}: {
  icon: IconComponent;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={() => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: theme.colors.card,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        paddingHorizontal: 12,
        paddingVertical: 8,
        ...theme.shadows.card,
      })}
    >
      <Icon size={15} color={theme.colors.textPrimary} strokeWidth={2} />
      <Text weight="medium" style={{ fontSize: 13, lineHeight: 17 }}>
        {label}
      </Text>
      <ChevronDown size={13} color={theme.colors.textSecondary} strokeWidth={2.2} />
    </Pressable>
  );
}

export function BookingPills() {
  const scheduledAt = useBookingStore((s) => s.scheduledAt);
  const setScheduledAt = useBookingStore((s) => s.setScheduledAt);
  const contact = useBookingStore((s) => s.contact);
  const setContact = useBookingStore((s) => s.setContact);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const openSchedule = useCallback(() => setScheduleOpen(true), []);
  const closeSchedule = useCallback(() => setScheduleOpen(false), []);
  const openContact = useCallback(() => setContactOpen(true), []);
  const closeContact = useCallback(() => setContactOpen(false), []);

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <Pill
        icon={Clock}
        label={
          scheduledAt
            ? `${formatBookingDate(scheduledAt)}, ${formatBookingTime(scheduledAt)}`
            : 'Pickup now'
        }
        onPress={openSchedule}
      />
      {/*
        This pill used to TOGGLE a label and nothing else — `bookingFor` reached
        no request, so "for someone else" was a word on a screen. It now opens
        the sheet that captures who the driver will actually meet.
      */}
      <Pill
        icon={User}
        label={contact ? contact.name : 'For me'}
        onPress={openContact}
      />

      <SchedulePickerSheet
        visible={scheduleOpen}
        scheduledAt={scheduledAt}
        onSelect={setScheduledAt}
        onClose={closeSchedule}
      />
      <ContactSheet
        visible={contactOpen}
        contact={contact}
        onSave={setContact}
        onClose={closeContact}
      />
    </View>
  );
}
