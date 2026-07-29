import React, { useCallback } from 'react';
import { Button, EmptyState, StatusBadge, type IconComponent } from '@towing/ui';
import { CreditCard, Wallet, Plus } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { paymentMethodsMock } from '@/features/account/data/paymentMethods.mock';
import type { PaymentKind } from '@/features/account/types';

const kindIcon: Record<PaymentKind, IconComponent> = { card: CreditCard, upi: Wallet, wallet: Wallet };

export function PaymentMethodsScreen() {
  const notReady = useCallback(() => {}, []);
  const methods = paymentMethodsMock;

  return (
    <SubScreen
      title="Payment Methods"
      footer={<Button label="Add Payment Method" leftIcon={Plus} fullWidth onPress={notReady} />}
    >
      {methods.length === 0 ? (
        <EmptyState icon={CreditCard} title="No payment methods" body="Add a card or UPI to pay for your tows." />
      ) : (
        <SettingsList>
          {methods.map((m) => (
            <SettingsRow
              key={m.id}
              icon={kindIcon[m.kind]}
              title={m.label}
              subtitle={m.detail}
              trailing={m.isDefault ? <StatusBadge label="Default" tone="success" /> : 'chevron'}
              onPress={notReady}
            />
          ))}
        </SettingsList>
      )}
    </SubScreen>
  );
}
