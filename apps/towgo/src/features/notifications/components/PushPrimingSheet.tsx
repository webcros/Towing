import React from 'react';
import { Modal, View } from 'react-native';
import { Bell } from '@/icons';
import { Button, Text } from '@towing/ui';
import { useTheme } from '@towing/theme';
import { track } from '@/lib/analytics/analytics';
import { storage } from '@/lib/storage/storage';
import { getPermission, pushAvailability, requestPermission } from '../push/pushClient';
import { registerRotatedToken } from '../push/usePushRegistration';
import { getPushToken } from '../push/pushClient';

const PRIMED_KEY = 'push.primed';

/**
 * A one-time explanation shown BEFORE the OS permission prompt.
 *
 * The OS prompt can only be answered once per install: a user who declines it
 * has to be walked into Settings to change their mind, and most never do. So
 * the prompt is spent on people who already know what it is for.
 *
 * Deliberately a sibling of the existing `ConsentCaptureOverlay` pattern rather
 * than a step inside it. Consent is a legal gate that blocks the app; this is
 * not — declining leaves everything working and simply means the customer
 * learns their driver has arrived by opening the app.
 */
export function shouldPrimePush(): boolean {
  if (!pushAvailability().available) return false;
  return storage.getString(PRIMED_KEY) !== 'true';
}

export function PushPrimingSheet({ onDone }: { onDone: () => void }) {
  const theme = useTheme();
  const [busy, setBusy] = React.useState(false);

  const finish = React.useCallback(() => {
    // Marked primed on EITHER answer. The whole point is to ask once.
    storage.set(PRIMED_KEY, 'true');
    onDone();
  }, [onDone]);

  const allow = React.useCallback(async () => {
    setBusy(true);
    try {
      const status = await requestPermission();
      track(status === 'granted' ? 'push_permission_granted' : 'push_permission_denied');
      if (status === 'granted') {
        // Re-register immediately: the device row already exists with a null
        // token from sign-in, and this is the moment it can carry a real one.
        const token = await getPushToken();
        if (token) await registerRotatedToken(token);
      }
    } finally {
      setBusy(false);
      finish();
    }
  }, [finish]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={finish}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.45)',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.surface0,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 24,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.brandTint,
            }}
          >
            <Bell size={24} color={theme.colors.brand} />
          </View>

          <Text variant="title">Know when your driver arrives</Text>
          <Text variant="body" color="secondary">
            We will let you know when a driver accepts your booking, when they are close, and when
            your payment goes through. Nothing else.
          </Text>

          <Button label="Turn on notifications" onPress={allow} loading={busy} />
          <Button label="Not now" variant="ghost" onPress={finish} disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

/** Exported for the settings screen, which shows the current state honestly. */
export async function currentPushPermission() {
  return getPermission();
}
