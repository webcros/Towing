import { env } from '@/lib/env';
import type { DriverCapabilitiesResponse, DriverCapabilitiesUpdate } from '../types';
import { capabilitiesMockSource } from './capabilitiesMockSource';
import { capabilitiesRestSource } from './capabilitiesRestSource';

/**
 * Boundary between UI and the already-shipped `PUT /driver/capabilities`
 * (Phase 11). There is no GET counterpart yet — see `capabilities.queries.ts`
 * for how the screen copes with that.
 */
export interface CapabilitiesDataSource {
  update(body: DriverCapabilitiesUpdate): Promise<DriverCapabilitiesResponse>;
}

export const capabilitiesDataSource: CapabilitiesDataSource = env.useMocks
  ? capabilitiesMockSource
  : capabilitiesRestSource;
