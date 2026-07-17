import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Text } from '../Text';
import { Button } from '../Button';
import type { IconComponent } from '../types';

export type ErrorStateProps = {
  title?: string;
  body?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: IconComponent;
  compact?: boolean;
};

/** Human-readable error + one recovery action (spec §10.9 — never raw codes). */
export function ErrorState({
  title = 'Something went wrong',
  body = 'Please check your connection and try again.',
  onRetry,
  retryLabel = 'Retry',
  icon: Icon,
  compact = false,
}: ErrorStateProps) {
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
          <Icon size={26} color={theme.colors.error} />
        </View>
      ) : null}
      <Text variant="title" align="center">
        {title}
      </Text>
      <Text variant="caption" color="secondary" align="center">
        {body}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: theme.spacing.md }}>
          <Button label={retryLabel} variant="secondary" size="md" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}
