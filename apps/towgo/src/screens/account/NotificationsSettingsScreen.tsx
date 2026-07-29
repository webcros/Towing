import React from 'react';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { Toggle } from '@/components/Toggle';
import { useNotificationPrefsStore } from '@/features/account/store/notificationPrefsStore';
import type { NotificationPrefKey } from '@/features/account/types';

const ITEMS: { key: NotificationPrefKey; title: string; subtitle: string }[] = [
  { key: 'bookingUpdates', title: 'Booking updates', subtitle: 'Status changes for your tows' },
  { key: 'driverArrival', title: 'Driver arrival alerts', subtitle: 'When your driver is nearby' },
  { key: 'promotions', title: 'Promotions & offers', subtitle: 'Deals and discounts' },
  { key: 'receipts', title: 'Trip receipts', subtitle: 'Invoices after each tow' },
];

export function NotificationsSettingsScreen() {
  const prefs = useNotificationPrefsStore((s) => s.prefs);
  const toggle = useNotificationPrefsStore((s) => s.toggle);

  return (
    <SubScreen title="Notifications">
      <SettingsList>
        {ITEMS.map((it) => (
          <SettingsRow
            key={it.key}
            title={it.title}
            subtitle={it.subtitle}
            trailing={<Toggle value={prefs[it.key]} onValueChange={() => toggle(it.key)} />}
          />
        ))}
      </SettingsList>
    </SubScreen>
  );
}
