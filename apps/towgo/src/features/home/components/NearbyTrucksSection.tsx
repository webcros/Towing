import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@towing/theme';
import { Card, SectionHeader, Text, MapPreview, ErrorState } from '@towing/ui';
import { ChevronRight, Navigation } from '@/icons';
import { useLocationStore } from '@/features/location/locationStore';
import { useNearbyDrivers } from '../api/home.queries';
import { FeaturedDriverRow, FeaturedDriverRowSkeleton } from './FeaturedDriverRow';

export type NearbyTrucksSectionProps = {
  isOnline: boolean;
  onViewAll: () => void;
  onRecenter: () => void;
};

function EmptyDriverRow() {
  const theme = useTheme();
  return (
    <View style={{ padding: theme.spacing.lg, alignItems: 'center' }}>
      <Text variant="caption" color="secondary" align="center">
        Few tow trucks nearby right now — you can still book and we&apos;ll widen the search.
      </Text>
    </View>
  );
}

export function NearbyTrucksSection({ isOnline, onViewAll, onRecenter }: NearbyTrucksSectionProps) {
  const theme = useTheme();
  const pickup = useLocationStore((s) => s.pickup);
  const { data, isPending, isError, refetch } = useNearbyDrivers(pickup.coords);
  const featured = data?.[0];

  let row: React.ReactNode;
  if (isPending) {
    row = <FeaturedDriverRowSkeleton />;
  } else if (isError) {
    row = (
      <ErrorState
        compact
        title="Couldn't load nearby trucks"
        body="Check your connection and try again."
        onRetry={() => refetch()}
      />
    );
  } else if (!featured) {
    row = <EmptyDriverRow />;
  } else {
    row = <FeaturedDriverRow driver={featured} />;
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <SectionHeader
        title="Nearby Tow Trucks"
        actionLabel="View All"
        actionIcon={ChevronRight}
        onAction={onViewAll}
      />
      <Card radius="cardLg" padding={0} style={{ overflow: 'hidden' }}>
        <MapPreview
          height={181}
          recenterIcon={Navigation}
          onRecenter={onRecenter}
          recenterDisabled={!isOnline}
        />
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.divider }}>
          {row}
        </View>
      </Card>
    </View>
  );
}
