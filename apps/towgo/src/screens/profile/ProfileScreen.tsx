import React from 'react';
import { View } from 'react-native';
import { Screen, AppBar, Text, EmptyState } from '@towing/ui';
import { User } from '@/icons';

export function ProfileScreen() {
  return (
    <Screen>
      <AppBar center={<Text variant="title">Profile</Text>} />
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={User}
          title="Your profile"
          body="Manage your vehicles, addresses and emergency contacts here."
        />
      </View>
    </Screen>
  );
}
