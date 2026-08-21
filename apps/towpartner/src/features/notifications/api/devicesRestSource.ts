import type { DeviceRegisterRequest } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { DevicesDataSource } from './devicesDataSource';

/** The DRIVER half of the dual-realm device routes — `/v1/driver/devices`. */
export const devicesRestSource: DevicesDataSource = {
  register(body) {
    return apiFetch<{ id: string }>('driver/devices', {
      method: 'POST',
      body: JSON.stringify(body),
      idempotent: true,
      // Registration is exactly the kind of call that fails at a job site on a
      // weak signal, and a driver who never re-registers stops getting offers.
      enqueueOnFailure: true,
    });
  },

  async unregister(installationId) {
    await apiFetch<void>('driver/devices', {
      method: 'DELETE',
      body: JSON.stringify({ installationId }),
      idempotent: true,
    });
  },
};

export type { DeviceRegisterRequest };
