import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text, Divider } from '@towing/ui';
import { Truck, Clock, StickyNote, CircleX } from '@/icons';
import { StatColumn } from '@/components/StatColumn';
import { useBookingStore } from '../store/bookingStore';
import { towTypes } from '../data/towTypes.data';
import { Pressable } from '@/motion';

export function RequestDetailsCard({ onCancel }: { onCancel: () => void }) {
  const theme = useTheme();
  const towTypeId = useBookingStore((s) => s.towTypeId);
  const scheduleMode = useBookingStore((s) => s.scheduleMode);
  const note = useBookingStore((s) => s.note);

  const towName = towTypes.find((t) => t.id === towTypeId)?.name ?? '—';
  const whenLabel = scheduleMode === 'now' ? 'Now' : 'Scheduled';
  const noteLabel = note.trim() || 'No note added';

  return (
    <View
      style={{
        backgroundColor: theme.colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 16,
        gap: 16,
        ...theme.shadows.card,
      }}
    >
      <Text weight="semibold" style={{ fontSize: 16, lineHeight: 22 }}>
        Request Details
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
        <StatColumn icon={Truck} label="Tow Type" value={towName} />
        <Divider vertical inset={2} />
        <StatColumn icon={Clock} label="When" value={whenLabel} />
        <Divider vertical inset={2} />
        <StatColumn icon={StickyNote} label="Note" value={noteLabel} />
      </View>

      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Cancel request"
        style={() => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          height: 50,
          borderRadius: 12,
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.error,
        })}
      >
        <CircleX size={18} color={theme.colors.error} strokeWidth={2} />
        <Text weight="semibold" style={{ fontSize: 15, lineHeight: 20, color: theme.colors.error }}>
          Cancel Request
        </Text>
      </Pressable>
    </View>
  );
}
