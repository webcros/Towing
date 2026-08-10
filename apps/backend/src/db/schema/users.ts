import type { VehicleCategory } from '@towing/api-contracts';
import { boolean, doublePrecision, index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { primaryId, timestamps } from './columns';
import { accountStatusEnum } from './enums';

/** Customers (§17 CUSTOMERS). Present in Phase 3 because bookings FK to it. */
export const users = pgTable(
  'users',
  {
    id: primaryId(),
    mobile: text('mobile').notNull().unique(),
    name: text('name'),
    email: text('email'),
    photoUrl: text('photo_url'),
    defaultLat: doublePrecision('default_lat'),
    defaultLng: doublePrecision('default_lng'),
    status: accountStatusEnum('status').notNull().default('active'),
    ...timestamps,
  },
  (t) => [index('idx_users_status').on(t.status)],
);

export const savedVehicles = pgTable(
  'saved_vehicles',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /**
     * The customer's own vehicle category (§9.1.5) — no DB enum, since the
     * taxonomy is a Phase 12 default (`ToBeDoneEhsan.md`) that may still
     * change; widening this stays a contract change only, never a migration.
     */
    type: text('type').notNull().$type<VehicleCategory>(),
    makeModel: text('make_model'),
    plate: text('plate'),
    rcUrl: text('rc_url'),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('idx_saved_vehicles_user').on(t.userId)],
);

export const addresses = pgTable(
  'addresses',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    fullAddress: text('full_address').notNull(),
    lat: doublePrecision('lat').notNull(),
    lng: doublePrecision('lng').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps,
  },
  (t) => [index('idx_addresses_user').on(t.userId)],
);

export const emergencyContacts = pgTable(
  'emergency_contacts',
  {
    id: primaryId(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    relation: text('relation'),
    ...timestamps,
  },
  (t) => [index('idx_emergency_contacts_user').on(t.userId)],
);
