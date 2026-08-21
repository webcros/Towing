import type { DeviceRegisterRequest } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { devicesMockSource } from './devicesMockSource';
import { devicesRestSource } from './devicesRestSource';

/** §12 device registration (Phase 13) — `POST/DELETE /v1/me/devices`. */
export interface DevicesDataSource {
  register(body: DeviceRegisterRequest): Promise<{ id: string }>;
  unregister(installationId: string): Promise<void>;
}

export const devicesDataSource: DevicesDataSource = env.useMocks
  ? devicesMockSource
  : devicesRestSource;
