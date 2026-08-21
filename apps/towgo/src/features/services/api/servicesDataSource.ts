import type { ServiceCatalogItem } from '@towing/api-contracts';
import { env } from '@/lib/env';
import { servicesMockSource } from './servicesMockSource';
import { servicesRestSource } from './servicesRestSource';

/**
 * `GET /v1/services` (§16.2) — replaces the static `services.data.ts` array
 * whose own comment said "catalog API comes later".
 */
export interface ServicesDataSource {
  list(): Promise<ServiceCatalogItem[]>;
}

export const servicesDataSource: ServicesDataSource = env.useMocks
  ? servicesMockSource
  : servicesRestSource;
