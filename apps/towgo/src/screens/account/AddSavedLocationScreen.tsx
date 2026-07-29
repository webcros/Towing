import React, { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { useTheme } from '@towing/theme';
import { Button, Text } from '@towing/ui';
import { MapPin, Trash2 } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import { useSavedLocationsStore } from '@/features/account/store/savedLocationsStore';
import type { LocationKind } from '@/features/account/types';
import type { RootStackParamList } from '@/navigation/types';

const KINDS: { value: LocationKind; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
];

export function AddSavedLocationScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddSavedLocation'>>();
  const locationId = route.params?.locationId;

  const addLocation = useSavedLocationsStore((s) => s.addLocation);
  const updateLocation = useSavedLocationsStore((s) => s.updateLocation);
  const removeLocation = useSavedLocationsStore((s) => s.removeLocation);
  const existing = locationId
    ? useSavedLocationsStore.getState().locations.find((l) => l.id === locationId)
    : undefined;

  const [kind, setKind] = useState<LocationKind>(existing?.kind ?? 'home');
  const [label, setLabel] = useState(existing?.label ?? '');
  const [address, setAddress] = useState(existing?.address ?? '');

  const notReady = useCallback(() => {}, []);
  const canSave = label.trim().length > 0 && address.trim().length > 0;
  const save = () => {
    const data = { kind, label: label.trim(), address: address.trim() };
    if (locationId) updateLocation(locationId, data);
    else addLocation(data);
    navigation.goBack();
  };
  const del = () => {
    if (locationId) removeLocation(locationId);
    navigation.goBack();
  };

  return (
    <SubScreen
      title={locationId ? 'Edit Location' : 'Add Location'}
      footer={<Button label="Save Location" fullWidth disabled={!canSave} onPress={save} />}
    >
      <View style={{ gap: 7 }}>
        <Text weight="medium" style={{ fontSize: 13, lineHeight: 17, color: theme.colors.textSecondary }}>
          Type
        </Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {KINDS.map((k) => {
            const selected = kind === k.value;
            return (
              <Pressable
                key={k.value}
                onPress={() => setKind(k.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 9,
                  borderRadius: theme.radii.pill,
                  borderWidth: 1,
                  borderColor: selected ? theme.colors.brand : theme.colors.border,
                  backgroundColor: selected ? theme.colors.brand : theme.colors.card,
                }}
              >
                <Text
                  weight="medium"
                  style={{ fontSize: 13.5, color: selected ? theme.colors.onBrand : theme.colors.textPrimary }}
                >
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Home" autoCapitalize="words" />
      <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Enter full address" multiline />

      <Pressable
        onPress={notReady}
        accessibilityRole="button"
        accessibilityLabel="Select on map"
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: theme.colors.borderStrong,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        <MapPin size={18} color={theme.colors.textSecondary} />
        <Text color="secondary" style={{ fontSize: 13.5 }}>
          Select on map
        </Text>
      </Pressable>

      {locationId ? (
        <Pressable
          onPress={del}
          accessibilityRole="button"
          accessibilityLabel="Delete location"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.error,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Trash2 size={17} color={theme.colors.error} />
          <Text weight="semibold" style={{ fontSize: 14.5, color: theme.colors.error }}>
            Delete Location
          </Text>
        </Pressable>
      ) : null}
    </SubScreen>
  );
}
