import type { DeviceRegisterRequest } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { DevicesDataSource } from './devicesDataSource';

export const devicesRestSource: DevicesDataSource = {
  register(body) {
    return apiFetch<{ id: string }>('me/devices', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotent: true,
    });
  },

  async unregister(installationId) {
    // A body-carrying DELETE, matching `DELETE /v1/me`. Called during logout,
    // so it must not be the thing that fails the sign-out.
    await apiFetch<void>('me/devices', {
      method: 'DELETE',
      body: JSON.stringify({ installationId }),
      idempotent: true,
    });
  },
};

export type { DeviceRegisterRequest };
