import React from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, Skeleton, ErrorState, type IconComponent } from '@towing/ui';
import { MapPin, Home, Briefcase, Plus, RefreshCw } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { SettingsList } from '@/components/SettingsList';
import { SettingsRow } from '@/components/SettingsRow';
import { useAddresses } from '@/features/account/api/addresses.queries';
import type { RootStackParamList } from '@/navigation/types';

/**
 * `SavedAddress` (the backend contract) has no `kind` — just a free-text
 * `label`. Home/Work still get their recognisable icon by matching the label
 * text; anything else falls back to a plain pin.
 */
function iconForLabel(label: string | null): IconComponent {
  const normalized = label?.trim().toLowerCase();
  if (normalized === 'home') return Home;
  if (normalized === 'work') return Briefcase;
  return MapPin;
}

export function SavedLocationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: addresses, isPending, isError, refetch } = useAddresses();

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
      {isError ? (
        <ErrorState title="Couldn't load your saved locations" onRetry={() => refetch()} icon={RefreshCw} />
      ) : isPending || !addresses ? (
        <>
          <Skeleton width="100%" height={72} radius={12} />
          <Skeleton width="100%" height={72} radius={12} />
        </>
      ) : addresses.length === 0 ? (
        <EmptyState icon={MapPin} title="No saved locations" body="Save Home, Work and other places for faster booking." />
      ) : (
        <SettingsList>
          {addresses.map((a) => (
            <SettingsRow
              key={a.id}
              icon={iconForLabel(a.label)}
              title={a.label ?? 'Saved place'}
              subtitle={a.fullAddress}
              trailing="chevron"
              onPress={() => navigation.navigate('AddSavedLocation', { locationId: a.id })}
            />
          ))}
        </SettingsList>
      )}
    </SubScreen>
  );
}
