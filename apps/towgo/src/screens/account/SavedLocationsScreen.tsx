import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, type IconComponent } from '@towing/ui';
import { Home, Briefcase, MapPin, Plus } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { useSavedLocationsStore } from '@/features/account/store/savedLocationsStore';
import type { LocationKind } from '@/features/account/types';
import type { RootStackParamList } from '@/navigation/types';

const kindIcon: Record<LocationKind, IconComponent> = { home: Home, work: Briefcase, other: MapPin };

export function SavedLocationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const locations = useSavedLocationsStore((s) => s.locations);

  return (
    <SubScreen
      title="Saved Locations"
      footer={
        <Button
          label="Add Location"
          leftIcon={Plus}
          fullWidth
          onPress={() => navigation.navigate('AddSavedLocation')}
        />
      }
    >
      {locations.length === 0 ? (
        <EmptyState icon={MapPin} title="No saved locations" body="Save Home, Work and other places for faster booking." />
      ) : (
        <SettingsList>
          {locations.map((l) => (
            <SettingsRow
              key={l.id}
              icon={kindIcon[l.kind]}
              title={l.label}
              subtitle={l.address}
              trailing="chevron"
              onPress={() => navigation.navigate('AddSavedLocation', { locationId: l.id })}
            />
          ))}
        </SettingsList>
      )}
    </SubScreen>
  );
}
