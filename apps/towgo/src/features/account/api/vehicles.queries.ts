import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SavedVehicleCreate, SavedVehicleUpdate } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { vehiclesDataSource } from './vehiclesDataSource';
import { vehiclesKeys } from './vehicles.keys';

/** My Vehicles list + Add/Edit Vehicle (spec §9.1.11). */
export function useVehicles() {
  return useQuery({
    queryKey: vehiclesKeys.list(),
    queryFn: () => vehiclesDataSource.list(),
  });
}

export function useCreateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SavedVehicleCreate) => vehiclesDataSource.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehiclesKeys.list() }),
  });
}

export function useUpdateVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ vehicleId, patch }: { vehicleId: string; patch: SavedVehicleUpdate }) =>
      vehiclesDataSource.update(vehicleId, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehiclesKeys.list() }),
  });
}

export function useDeleteVehicle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vehicleId: string) => vehiclesDataSource.remove(vehicleId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehiclesKeys.list() }),
  });
}

/**
 * RC-photo upload, all three steps. The middle step is a raw `fetch` PUT of
 * the image bytes straight to the presigned URL — deliberately not
 * `apiFetch`, which would attach this app's own bearer token to a request the
 * presigned URL already authorizes on its own (same shape the backend's own
 * upload tests use). In mock mode there is no real `uploadUrl` to PUT to, so
 * that step is skipped and only the presign/confirm round-trip runs.
 */
export function useUploadVehicleRc() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vehicleId, localUri }: { vehicleId: string; localUri: string }) => {
      const presigned = await vehiclesDataSource.presignRc(vehicleId);

      if (!env.useMocks) {
        const fileRes = await fetch(localUri);
        const bytes = await fileRes.blob();
        const putRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: bytes,
          headers: { 'Content-Type': 'image/jpeg' },
        });
        if (!putRes.ok) throw new Error('RC upload failed');
      }

      await vehiclesDataSource.confirmRc(vehicleId, presigned.key);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: vehiclesKeys.list() }),
  });
}
