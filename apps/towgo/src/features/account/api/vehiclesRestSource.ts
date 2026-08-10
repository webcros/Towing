import type { SavedVehicle, VehicleRcPresignResponse } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { VehiclesDataSource } from './vehiclesDataSource';

export const vehiclesRestSource: VehiclesDataSource = {
  list() {
    return apiFetch<SavedVehicle[]>('me/vehicles');
  },

  create(input) {
    return apiFetch<SavedVehicle>('me/vehicles', {
      method: 'POST',
      body: JSON.stringify(input),
      idempotent: true,
    });
  },

  update(vehicleId, patch) {
    return apiFetch<SavedVehicle>(`me/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
      idempotent: true,
    });
  },

  async remove(vehicleId) {
    await apiFetch<void>(`me/vehicles/${vehicleId}`, { method: 'DELETE', idempotent: true });
  },

  // Not idempotent on purpose: presign mints a fresh upload slot, not a
  // resource mutation — a retry after the first URL expired should get a new
  // one, not a replayed response pointing at a dead slot.
  presignRc(vehicleId) {
    return apiFetch<VehicleRcPresignResponse>(`me/vehicles/${vehicleId}/rc/presign`, {
      method: 'POST',
    });
  },

  async confirmRc(vehicleId, key) {
    await apiFetch<void>(`me/vehicles/${vehicleId}/rc/confirm`, {
      method: 'POST',
      body: JSON.stringify({ key }),
      idempotent: true,
    });
  },
};
