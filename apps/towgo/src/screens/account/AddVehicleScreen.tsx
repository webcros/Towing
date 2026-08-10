import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '@towing/theme';
import type { VehicleCategory } from '@towing/api-contracts';
import { Button, Text, Skeleton } from '@towing/ui';
import { Camera, Trash2, CircleCheck } from '@/icons';
import { SubScreen } from '@/components/SubScreen';
import { TextField } from '@/components/TextField';
import {
  useVehicles,
  useCreateVehicle,
  useUpdateVehicle,
  useDeleteVehicle,
  useUploadVehicleRc,
} from '@/features/account/api/vehicles.queries';
import type { RootStackParamList } from '@/navigation/types';
import { Pressable } from '@/motion';

const TYPES: { value: VehicleCategory; label: string; hint: string }[] = [
  { value: 'hatchback', label: 'Hatchback', hint: 'Compact cars' },
  { value: 'sedan', label: 'Sedan', hint: 'Mid-size cars' },
  { value: 'suv', label: 'SUV', hint: 'SUVs, crossovers' },
  { value: 'muv', label: 'MUV', hint: 'Vans' },
  { value: 'luxury', label: 'Luxury', hint: 'Premium, EVs' },
  { value: 'bike', label: 'Bike', hint: 'Two-wheelers' },
  { value: 'other', label: 'Other', hint: 'Anything else' },
];

export function AddVehicleScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'AddVehicle'>>();
  const vehicleId = route.params?.vehicleId;

  const { data: vehicles, isPending: vehiclesPending } = useVehicles();
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const uploadRc = useUploadVehicleRc();

  const existing = vehicleId ? vehicles?.find((v) => v.id === vehicleId) : undefined;

  const [type, setType] = useState<VehicleCategory>('hatchback');
  const [makeModel, setMakeModel] = useState('');
  const [plate, setPlate] = useState('');
  const [seeded, setSeeded] = useState(!vehicleId);
  // Picked before the vehicle exists yet — uploaded right after create succeeds.
  const [pendingRcUri, setPendingRcUri] = useState<string | null>(null);

  useEffect(() => {
    if (existing && !seeded) {
      setType(existing.type);
      setMakeModel(existing.makeModel ?? '');
      setPlate(existing.plate ?? '');
      setSeeded(true);
    }
  }, [existing, seeded]);

  const pickRcPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || result.assets.length === 0) return;

    const uri = result.assets[0].uri;
    if (vehicleId) {
      uploadRc.mutate({ vehicleId, localUri: uri });
    } else {
      setPendingRcUri(uri);
    }
  };

  const canSave = makeModel.trim().length > 0 && plate.trim().length > 0;

  // Awaits the RC upload instead of firing it and navigating away
  // immediately — a failed presigned PUT (dropped connection, expired
  // signature, backend's size cap) was previously invisible: the user saw
  // "vehicle saved" and had no way to know the photo never uploaded.
  const save = async () => {
    const data = { type, makeModel: makeModel.trim(), plate: plate.trim() };
    try {
      if (vehicleId) {
        await updateVehicle.mutateAsync({ vehicleId, patch: data });
      } else {
        const created = await createVehicle.mutateAsync(data);
        if (pendingRcUri) {
          try {
            await uploadRc.mutateAsync({ vehicleId: created.id, localUri: pendingRcUri });
          } catch (e) {
            Alert.alert(
              'RC upload failed',
              e instanceof Error
                ? e.message
                : 'Your vehicle was saved, but the RC photo did not upload. Open the vehicle to try again.',
            );
          }
        }
      }
      navigation.goBack();
    } catch {
      Alert.alert('Could not save vehicle', 'Please try again.');
    }
  };
  const del = () => {
    if (vehicleId) deleteVehicle.mutate(vehicleId, { onSuccess: () => navigation.goBack() });
  };

  const saving = createVehicle.isPending || updateVehicle.isPending || uploadRc.isPending;
  const rcStatus = existing?.rcUrl
    ? 'RC uploaded'
    : uploadRc.isPending
      ? 'Uploading…'
      : pendingRcUri
        ? 'RC selected — uploads on save'
        : 'Upload RC (optional)';
  const rcDone = !!existing?.rcUrl || (!!pendingRcUri && !vehicleId);

  if (vehicleId && vehiclesPending) {
    return (
      <SubScreen title="Edit Vehicle">
        <Skeleton width="100%" height={90} radius={12} />
        <Skeleton width="100%" height={64} radius={12} />
        <Skeleton width="100%" height={64} radius={12} />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      title={vehicleId ? 'Edit Vehicle' : 'Add Vehicle'}
      footer={<Button label="Save Vehicle" fullWidth disabled={!canSave} loading={saving} onPress={save} />}
    >
      <View style={{ gap: 7 }}>
        <Text weight="medium" style={{ fontSize: 13, lineHeight: 17, color: theme.colors.textSecondary }}>
          Vehicle type
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {TYPES.map((t) => {
            const selected = type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => setType(t.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={{
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: selected ? theme.colors.brand : theme.colors.border,
                  backgroundColor: selected ? theme.colors.brandTint : theme.colors.card,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  gap: 2,
                  minWidth: '31%',
                }}
              >
                <Text weight="semibold" style={{ fontSize: 14, lineHeight: 19 }}>
                  {t.label}
                </Text>
                <Text color="secondary" style={{ fontSize: 11, lineHeight: 15 }}>
                  {t.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TextField label="Make & Model" value={makeModel} onChangeText={setMakeModel} placeholder="e.g. Maruti Swift" autoCapitalize="words" />
      <TextField label="Number Plate" value={plate} onChangeText={setPlate} placeholder="KA 01 AB 1234" autoCapitalize="characters" />

      <Pressable
        onPress={pickRcPhoto}
        disabled={uploadRc.isPending}
        accessibilityRole="button"
        accessibilityLabel="Upload RC document"
        style={{
          borderRadius: 12,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: rcDone ? theme.colors.success : theme.colors.borderStrong,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: uploadRc.isPending ? 0.6 : 1,
        }}
      >
        {rcDone ? (
          <CircleCheck size={18} color={theme.colors.success} />
        ) : (
          <Camera size={18} color={theme.colors.textSecondary} />
        )}
        <Text color={rcDone ? 'success' : 'secondary'} style={{ fontSize: 14 }}>
          {rcStatus}
        </Text>
      </Pressable>

      {vehicleId ? (
        <Pressable
          onPress={del}
          disabled={deleteVehicle.isPending}
          accessibilityRole="button"
          accessibilityLabel="Delete vehicle"
          style={() => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: 48,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.error,
            opacity: deleteVehicle.isPending ? 0.6 : 1,
          })}
        >
          <Trash2 size={17} color={theme.colors.error} />
          <Text weight="semibold" style={{ fontSize: 14, color: theme.colors.error }}>
            Delete Vehicle
          </Text>
        </Pressable>
      ) : null}
    </SubScreen>
  );
}
