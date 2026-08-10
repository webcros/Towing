import { Inject, Injectable } from '@nestjs/common';
import type { SavedAddress, SavedAddressCreate, SavedAddressUpdate } from '@towing/api-contracts';
import { and, eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { DB, type Database } from '../../db/db.module';
import { addresses } from '../../db/schema';

const COLUMNS = {
  id: addresses.id,
  label: addresses.label,
  fullAddress: addresses.fullAddress,
  lat: addresses.lat,
  lng: addresses.lng,
  isDefault: addresses.isDefault,
};

/** `GET/POST/PUT/DELETE /v1/me/addresses` (Phase 12). */
@Injectable()
export class MeAddressesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(userId: string): Promise<SavedAddress[]> {
    return this.db.select(COLUMNS).from(addresses).where(eq(addresses.userId, userId));
  }

  async create(userId: string, body: SavedAddressCreate): Promise<SavedAddress> {
    const [row] = await this.db
      .insert(addresses)
      .values({ userId, ...body })
      .returning(COLUMNS);
    return row!;
  }

  async update(userId: string, addressId: string, body: SavedAddressUpdate): Promise<SavedAddress> {
    const [row] = await this.db
      .update(addresses)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .returning(COLUMNS);

    if (!row) throw ApiException.notFound('Address not found');
    return row;
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const [row] = await this.db
      .delete(addresses)
      .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)))
      .returning({ id: addresses.id });

    if (!row) throw ApiException.notFound('Address not found');
  }
}
