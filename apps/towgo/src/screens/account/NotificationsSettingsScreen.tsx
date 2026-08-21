import React from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { ErrorState, Text } from '@towing/ui';
import { useTheme } from '@towing/theme';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { Toggle } from '@/components/Toggle';
import {
  useNotificationPrefs,
  useUpdateNotificationPrefs,
} from '@/features/notifications/api/notifications.queries';
import { getPermission, pushAvailability, type PushPermission } from '@/features/notifications/push/pushClient';

/**
 * §12.3's preferences, against the SERVER model (Phase 13).
 *
 * Until now this screen drove `notificationPrefsStore` — four booleans in
 * memory that reset on every launch and never reached a server, so every toggle
 * on it was decoration.
 *
 * ⚠ ONLY THE OPT-OUT-ABLE CATEGORIES GET A TOGGLE. §12.3 makes transactional
 * and safety notifications always-on, and the backend enforces that in the
 * fan-out worker regardless of what any client sends. Rendering them as
 * switches would be a lie the user could act on; they are rendered as
 * "Always on" rows instead, which is the honest version of the same list.
 */
const ALWAYS_ON = [
  { title: 'Booking updates', subtitle: 'Confirmation, driver assigned, arrival' },
  { title: 'Trip receipts', subtitle: 'Invoices and payment confirmations' },
  { title: 'Safety alerts', subtitle: 'SOS and account security' },
];

export function NotificationsSettingsScreen() {
  const theme = useTheme();
  const prefs = useNotificationPrefs();
  const update = useUpdateNotificationPrefs();
  const [permission, setPermission] = React.useState<PushPermission | null>(null);

  const availability = pushAvailability();

  React.useEffect(() => {
    void getPermission().then(setPermission);
  }, []);

  return (
    <SubScreen title="Notifications">
      {/*
        The device's own state comes first, because it overrides everything
        below it: a preference that is on while the OS permission is denied
        means nothing arrives, and a screen that did not say so would be
        actively misleading.
      */}
      {!availability.available ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text variant="caption" color="secondary">
            {availability.reason === 'expo_go'
              ? 'Push notifications need the full app — they do not work in Expo Go.'
              : availability.reason === 'simulator'
                ? 'Push notifications need a physical device.'
                : 'Push notifications are unavailable on this device.'}
          </Text>
        </View>
      ) : permission === 'denied' ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text variant="caption" color="secondary">
            Notifications are turned off for MiTow in your device settings.{' '}
            <Text
              variant="caption"
              color="brand"
              onPress={() => void Linking.openSettings()}
              accessibilityRole="button"
            >
              Open settings
            </Text>
          </Text>
        </View>
      ) : null}

      {prefs.isPending ? (
        <View style={{ paddingVertical: 32, alignItems: 'center' }}>
          <ActivityIndicator color={theme.colors.brand} />
        </View>
      ) : prefs.isError ? (
        <ErrorState
          title="Could not load your preferences"
          onRetry={() => void prefs.refetch()}
        />
      ) : (
        <SettingsList>
          <SettingsRow
            title="Promotions & offers"
            subtitle="Deals and discounts. Off by default."
            trailing={
              <Toggle
                value={prefs.data?.promotions ?? false}
                onValueChange={(value) => update.mutate({ promotions: value })}
              />
            }
          />
        </SettingsList>
      )}

      <SettingsList>
        {ALWAYS_ON.map((item) => (
          <SettingsRow
            key={item.title}
            title={item.title}
            subtitle={item.subtitle}
            trailing={
              <Text variant="caption" color="secondary">
                Always on
              </Text>
            }
          />
        ))}
      </SettingsList>

      <View style={{ paddingHorizontal: 16 }}>
        <Text variant="caption" color="secondary">
          Booking, safety and payment messages cannot be switched off — they are how we tell you
          what is happening with a tow you have paid for.
        </Text>
      </View>
    </SubScreen>
  );
}
