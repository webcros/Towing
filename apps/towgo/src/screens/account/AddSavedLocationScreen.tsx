import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useTheme } from '@towing/theme';
import { Button, Text, Skeleton } from '@towing/ui';
import { MapPin, Trash2, LocateFixed } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import {
  useAddresses,
  useCreateAddress,
  useUpdateAddress,
  useDeleteAddress,
} from '@/features/account/api/addresses.queries';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

/**
 * Stopgap coordinate source: device GPS, reverse-geocoded into the address
 * text field. A real map-pin picker is a later phase's `BookLocation` rebuild
 * — out of scope here, so there is no way to type a plain address without
 * also fetching a device fix to back it with `lat`/`lng` (the contract
 * requires both).
 */
export function AddSavedLocationScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddSavedLocation'>>();
  const locationId = route.params?.locationId;

  const { data: addresses, isPending: addressesPending } = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();

  const existing = locationId ? addresses?.find((a) => a.id === locationId) : undefined;

  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [seeded, setSeeded] = useState(!locationId);
  const [locating, setLocating] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    if (existing && !seeded) {
      setLabel(existing.label ?? '');
      setAddress(existing.fullAddress);
      setCoords({ lat: existing.lat, lng: existing.lng });
      setSeeded(true);
    }
  }, [existing, seeded]);

  const useCurrentLocation = async () => {
    setLocating(true);
    setLocationDenied(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationDenied(true);
        return;
      }
      const position = await Location.getCurrentPositionAsync();
      const { latitude, longitude } = position.coords;
      setCoords({ lat: latitude, lng: longitude });

      try {
        const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (place) {
          const parts = [place.name, place.street, place.city, place.region].filter(Boolean);
          if (parts.length > 0) setAddress(parts.join(', '));
        }
      } catch {
        // Reverse geocoding is a nicety — the coordinates are already captured either way.
      }
    } finally {
      setLocating(false);
    }
  };

  // A create screen defaults to the device fix so most saves need zero manual location work.
  useEffect(() => {
    if (!locationId) useCurrentLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const canSave = address.trim().length > 0 && !!coords;
  const save = () => {
    if (!coords) return;
    const data = { label: label.trim() ? label.trim() : undefined, fullAddress: address.trim(), lat: coords.lat, lng: coords.lng };
    if (locationId) {
      updateAddress.mutate({ addressId: locationId, patch: data }, { onSuccess: () => navigation.goBack() });
    } else {
      createAddress.mutate(data, { onSuccess: () => navigation.goBack() });
    }
  };
  const del = () => {
    if (locationId) deleteAddress.mutate(locationId, { onSuccess: () => navigation.goBack() });
  };

  const saving = createAddress.isPending || updateAddress.isPending;

  if (locationId && addressesPending) {
    return (
      <SubScreen title="Edit Location">
        <Skeleton width="100%" height={64} radius={12} />
        <Skeleton width="100%" height={96} radius={12} />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={locationId ? 'Edit Location' : 'Add Location'}
      footer={<Button label="Save Location" fullWidth disabled={!canSave} loading={saving} onPress={save} />}
    >
      <TextField label="Label" value={label} onChangeText={setLabel} placeholder="e.g. Home" autoCapitalize="words" />
      <TextField label="Address" value={address} onChangeText={setAddress} placeholder="Enter full address" multiline />

      <Pressable
        onPress={useCurrentLocation}
        disabled={locating}
        accessibilityRole="button"
        accessibilityLabel="Use current location"
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: coords ? theme.colors.success : theme.colors.borderStrong,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {locating ? (
          <ActivityIndicator size="small" color={theme.colors.brand} />
        ) : (
          <LocateFixed size={18} color={coords ? theme.colors.success : theme.colors.textSecondary} />
        )}
        <Text color={coords ? 'success' : 'secondary'} style={{ fontSize: 14 }}>
          {locating ? 'Locating…' : coords ? 'Location captured' : 'Use current location'}
        </Text>
      </Pressable>

      {locationDenied ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <MapPin size={14} color={theme.colors.error} />
          <Text color="error" style={{ fontSize: 12, lineHeight: 16, flex: 1 }}>
            Location access denied — enable it in Settings, or the address can't be saved.
          </Text>
        </View>
      ) : null}

      {locationId ? (
        <Pressable
          onPress={del}
          disabled={deleteAddress.isPending}
          accessibilityRole="button"
          accessibilityLabel="Delete location"
          style={() => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.error,
            opacity: deleteAddress.isPending ? 0.6 : 1,
          })}
        >
          <Trash2 size={17} color={theme.colors.error} />
          <Text weight="semibold" style={{ fontSize: 14, color: theme.colors.error }}>
            Delete Location
          </Text>
        </Pressable>
      ) : null}
    </SubScreen>
  );
}
