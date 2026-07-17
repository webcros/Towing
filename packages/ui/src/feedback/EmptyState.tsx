import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '../Text';
import { Button } from '../Button';
import type { IconComponent } from '../types';

export type EmptyStateProps = {
  icon?: IconComponent;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
};

export function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: compact ? theme.spacing.xl : theme.spacing.xxxl,
        paddingHorizontal: theme.spacing.lg,
        gap: theme.spacing.sm,
      }}
    >
      {Icon ? (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface1,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: theme.spacing.xs,
          }}
        >
          <Icon size={26} color={theme.colors.textTertiary} />
        </View>
      ) : null}
      <Text variant="title" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="caption" color="secondary" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={actionLabel} variant="secondary" size="md" onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
