import React from 'react';
import { View } from 'react-native';
import { recentLocations, type RecentLocation } from '../data/recentLocations.data';
import { RecentLocationRow } from './RecentLocationRow';

export function RecentLocationsList({
  onSelect,
}: {
  onSelect: (location: RecentLocation) => void;
}) {
  return (
    <View>
      {recentLocations.map((location, index) => (
        <RecentLocationRow
          key={location.id}
          location={location}
          onPress={() => onSelect(location)}
          divider={index < recentLocations.length - 1}
        />
      ))}
    </View>
  );
}
