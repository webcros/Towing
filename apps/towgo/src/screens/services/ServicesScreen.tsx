import React from 'react';
import { View } from 'react-native';
import { Screen, AppBar, Text, EmptyState } from '@towing/ui';
import { Wrench } from '@/icons';

export function ServicesScreen() {
  return (
    <Screen>
      <AppBar center={<Text variant="title">Services</Text>} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={Wrench}
          title="Services"
          body="Browse towing and roadside assistance services here."
        />
      </View>
    </Screen>
  );
}
