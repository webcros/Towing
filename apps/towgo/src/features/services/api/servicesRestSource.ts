import type { ServiceCatalogItem } from '@towing/api-contracts';
import { apiFetch } from '@/lib/api/client';
import type { ServicesDataSource } from './servicesDataSource';

export const servicesRestSource: ServicesDataSource = {
  list: () => apiFetch<ServiceCatalogItem[]>('services'),
};
