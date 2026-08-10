import { boolean, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { geographyPolygon } from '../geography';
import { primaryId, timestamps } from './columns';

/**
 * Geofenced operating areas (§17 GEOFENCING & DISPATCH CONFIG). `dispatchConfig`
 * holds the per-zone radius ladder / cap / offer-timeout overrides so §6.7
 * tuning never needs a deploy.
 */
export const serviceZones = pgTable('service_zones', {
  id: primaryId(),
  name: text('name').notNull(),
  // GIST index added in the migration.
  area: geographyPolygon('area').notNull(),
  surgeBand: text('surge_band'),
  isHighway: boolean('is_highway').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  dispatchConfig: jsonb('dispatch_config').$type<Record<string, unknown>>(),
  ...timestamps,
});
