import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { SectionHeader } from '@towing/ui';
import { quickActions } from '../mocks/quickActions.data';
import type { QuickActionId } from '../types';
import { QuickActionCard } from './QuickActionCard';

export function QuickActionsGrid({ onAction }: { onAction: (id: QuickActionId) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader title="Quick Actions" />
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {quickActions.map((action) => (
          <QuickActionCard key={action.id} action={action} onPress={() => onAction(action.id)} />
        ))}
      </View>
    </View>
  );
}
