import { Inject, Injectable } from '@nestjs/common';
import type {
  SavedVehicle,
  SavedVehicleCreate,
  SavedVehicleUpdate,
  VehicleRcConfirmRequest,
  VehicleRcPresignResponse,
} from '@towing/api-contracts';
import { and, eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { PresignedUploadService } from '../../common/storage/presigned-upload.helper';
import { DB, type Database } from '../../db/db.module';
import { savedVehicles } from '../../db/schema';

export const CUSTOMER_VEHICLES_KEY_PREFIX = 'customer-vehicles';

const COLUMNS = {
  id: savedVehicles.id,
  type: savedVehicles.type,
  makeModel: savedVehicles.makeModel,
  plate: savedVehicles.plate,
  rcUrl: savedVehicles.rcUrl,
  isDefault: savedVehicles.isDefault,
};

/** `GET/POST/PUT/DELETE /v1/me/vehicles` + RC photo presign/confirm (Phase 12). */
@Injectable()
export class MeVehiclesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly uploads: PresignedUploadService,
  ) {}

  list(userId: string): Promise<SavedVehicle[]> {
    return this.db.select(COLUMNS).from(savedVehicles).where(eq(savedVehicles.userId, userId));
  }

  async create(userId: string, body: SavedVehicleCreate): Promise<SavedVehicle> {
    const [row] = await this.db
      .insert(savedVehicles)
      .values({ userId, ...body })
      .returning(COLUMNS);
    return row!;
  }

  async update(userId: string, vehicleId: string, body: SavedVehicleUpdate): Promise<SavedVehicle> {
    const [row] = await this.db
      .update(savedVehicles)
      .set({ ...body, updatedAt: new Date() })
      // Both predicates, not just id: a vehicle id that exists but belongs to
      // someone else must 404, not silently update the wrong owner's row.
      .where(and(eq(savedVehicles.id, vehicleId), eq(savedVehicles.userId, userId)))
      .returning(COLUMNS);

    if (!row) throw ApiException.notFound('Vehicle not found');
    return row;
  }

  async remove(userId: string, vehicleId: string): Promise<void> {
    const [row] = await this.db
      .delete(savedVehicles)
      .where(and(eq(savedVehicles.id, vehicleId), eq(savedVehicles.userId, userId)))
      .returning({ id: savedVehicles.id });

    if (!row) throw ApiException.notFound('Vehicle not found');
  }

  async presignRc(userId: string, vehicleId: string): Promise<VehicleRcPresignResponse> {
    await this.assertOwned(userId, vehicleId);
    return this.uploads.presign(CUSTOMER_VEHICLES_KEY_PREFIX, userId, `rc-${vehicleId}`);
  }

  async confirmRc(userId: string, vehicleId: string, body: VehicleRcConfirmRequest): Promise<void> {
    await this.assertOwned(userId, vehicleId);

    if (!this.uploads.isOwnKey(body.key, CUSTOMER_VEHICLES_KEY_PREFIX, userId, `rc-${vehicleId}`)) {
      throw ApiException.forbidden('This key was not issued to you');
    }

    await this.db
      .update(savedVehicles)
      .set({ rcUrl: `local://${body.key}`, updatedAt: new Date() })
      .where(eq(savedVehicles.id, vehicleId));
  }

  private async assertOwned(userId: string, vehicleId: string): Promise<void> {
    const [row] = await this.db
      .select({ id: savedVehicles.id })
      .from(savedVehicles)
      .where(and(eq(savedVehicles.id, vehicleId), eq(savedVehicles.userId, userId)))
      .limit(1);
    if (!row) throw ApiException.notFound('Vehicle not found');
  }
}
