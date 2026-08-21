import React, { useMemo } from 'react';
import { Modal, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@towing/theme';
import { Button, Text } from '@towing/ui';
import { Check } from '@/icons';
import { Pressable } from '@/motion';
import { formatBookingDate, formatBookingTime } from '@/utils/format';

/**
 * §9.1.5's "schedule for later".
 *
 * The pill that opens this had `onPress={() => {}}` until Phase 15, so
 * `scheduleMode: 'later'` was unreachable — the store field existed and nothing
 * could ever set it.
 *
 * PRESETS, NOT A CALENDAR, and deliberately. A real date/time picker means
 * `@react-native-community/datetimepicker`, a native module — and no EAS or
 * dev-client build has ever been produced for this app, so a native dependency
 * added now would be invisible until the first build crashed on it. That is
 * exactly the failure Phase 12 recorded (invariant 66: a permission call added
 * without its plugin survived a clean typecheck and a clean review). Presets
 * cover what a tow is actually scheduled for — later today, tonight, tomorrow
 * morning — need nothing native, and work the moment they are written. The
 * calendar can land in Phase 16 alongside the maps rebuild.
 */
interface Option {
  label: string;
  at: Date | null;
}

function buildOptions(now: Date): Option[] {
  const plusHours = (hours: number) => new Date(now.getTime() + hours * 3_600_000);

  const tonight = new Date(now);
  tonight.setHours(20, 0, 0, 0);

  const tomorrowMorning = new Date(now);
  tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
  tomorrowMorning.setHours(9, 0, 0, 0);

  return [
    { label: 'Now', at: null },
    { label: 'In 1 hour', at: plusHours(1) },
    { label: 'In 3 hours', at: plusHours(3) },
    // Dropped once it is past — an option that would be rejected as "in the
    // past" by the server should not be offered.
    ...(tonight.getTime() > now.getTime() + 60_000
      ? [{ label: 'Tonight, 8:00 PM', at: tonight }]
      : []),
    { label: 'Tomorrow, 9:00 AM', at: tomorrowMorning },
  ];
}

export function SchedulePickerSheet({
  visible,
  scheduledAt,
  onSelect,
  onClose,
}: {
  visible: boolean;
  scheduledAt: string | null;
  onSelect: (iso: string | null) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const options = useMemo(() => buildOptions(new Date()), [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
        <View
          style={{
            backgroundColor: theme.colors.surface0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: theme.spacing.xxl,
            paddingBottom: Math.max(insets.bottom, theme.spacing.xxl),
            paddingHorizontal: theme.spacing.xxl,
            gap: theme.spacing.lg,
          }}
        >
          <Text weight="semibold" style={{ fontSize: 18 }}>
            When do you need the tow?
          </Text>

          <View style={{ gap: theme.spacing.sm }}>
            {options.map((option) => {
              const iso = option.at?.toISOString() ?? null;
              const selected = iso === scheduledAt;

              return (
                <Pressable
                  key={option.label}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    paddingVertical: 14,
                    paddingHorizontal: theme.spacing.lg,
                    borderRadius: theme.radii.button,
                    borderWidth: 1,
                    borderColor: selected ? theme.colors.brand : theme.colors.border,
                    backgroundColor: selected ? theme.colors.brandTint : theme.colors.card,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text weight={selected ? 'semibold' : 'regular'}>{option.label}</Text>
                    {option.at ? (
                      <Text color="secondary" style={{ fontSize: 12, lineHeight: 18 }}>
                        {formatBookingDate(option.at.toISOString())} ·{' '}
                        {formatBookingTime(option.at.toISOString())}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Check size={18} color={theme.colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>

          <Text color="secondary" style={{ fontSize: 12, lineHeight: 18 }}>
            A scheduled tow is confirmed now and dispatched at the time you pick.
          </Text>

          <Button label="Close" variant="secondary" onPress={onClose} fullWidth />
        </View>
      </View>
    </Modal>
  );
}
