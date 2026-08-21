import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, Skeleton } from '@towing/ui';

/** `ServiceCard`'s exact geometry as bones — same 68dp tile, same 16dp gap. */
export function ServiceCardSkeleton() {
  const theme = useTheme();

  return (
    <Card
      radius="sheet"
      padding={17}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderColor: theme.colors.border,
      }}
    >
      <Skeleton width={68} height={68} radius={16} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="55%" height={17} radius={theme.radii.input} />
        <Skeleton width="85%" height={11} radius={theme.radii.input} />
      </View>
    </Card>
  );
}
