import React from 'react';
import { ScrollView } from 'react-native';
import { towTypes } from '../data/towTypes.data';
import { useBookingStore } from '../store/bookingStore';
import { TowTypeCard } from './TowTypeCard';

export function TowTypeCarousel() {
  const towTypeId = useBookingStore((s) => s.towTypeId);
  const setTowType = useBookingStore((s) => s.setTowType);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 14, gap: 13 }}
    >
      {towTypes.map((towType) => (
        <TowTypeCard
          key={towType.id}
          towType={towType}
          selected={towType.id === towTypeId}
          onPress={() => setTowType(towType.id)}
        />
      ))}
    </ScrollView>
  );
}
