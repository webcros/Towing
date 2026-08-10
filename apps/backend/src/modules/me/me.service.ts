import { Inject, Injectable } from '@nestjs/common';
import type { CustomerProfile, CustomerProfileUpdate } from '@towing/api-contracts';
import { eq } from 'drizzle-orm';
import { ApiException } from '../../common/errors/api-exception';
import { DB, type Database } from '../../db/db.module';
import { users } from '../../db/schema';

/** `GET/PUT /v1/me` — the customer's own profile (Phase 12). */
@Injectable()
export class MeService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getProfile(userId: string): Promise<CustomerProfile> {
    const [row] = await this.db
      .select({
        id: users.id,
        mobile: users.mobile,
        name: users.name,
        email: users.email,
        photoUrl: users.photoUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!row) throw ApiException.notFound('Profile not found');
    return row;
  }

  async updateProfile(userId: string, body: CustomerProfileUpdate): Promise<CustomerProfile> {
    const [updated] = await this.db
      .update(users)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.photoUrl !== undefined ? { photoUrl: body.photoUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        mobile: users.mobile,
        name: users.name,
        email: users.email,
        photoUrl: users.photoUrl,
      });

    if (!updated) throw ApiException.notFound('Profile not found');
    return updated;
  }
}
