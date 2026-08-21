import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { ErrorCodes, type DeviceRegisterRequest } from '@towing/api-contracts';
import { DB, type Database } from '../../db/db.module';
import { devices } from '../../db/schema/devices';
import { ApiException } from '../errors/api-exception';
import { isUniqueViolation } from '../errors/pg-errors';

export type DeviceSubjectType = 'user' | 'driver';

/**
 * The device registry — the only writer of `devices`.
 *
 * TWO UNIQUENESS RULES, AND BOTH MATTER FOR A DIFFERENT REASON:
 *
 *  `uq_devices_subject_installation (subject_type, subject_id, installation_id)`
 *      makes re-registration an UPDATE. Expo push tokens rotate, and without a
 *      stable installation id every rotation would insert another row and the
 *      same person would receive every notification twice, then three times.
 *      Deliberately not unique on `installation_id` alone: one handset can hold
 *      a customer registration and a driver registration at once, exactly as
 *      `users.mobile` and `drivers.mobile` are independent unique keys.
 *
 *  `uq_devices_push_token (push_token) WHERE push_token IS NOT NULL AND revoked_at IS NULL`
 *      is the SHARED-HANDSET GUARD. A push token addresses a device, not an
 *      account. Driver A logs out (or is suspended) on a depot phone, driver B
 *      logs in: without this, A's row still holds a live token pointing at that
 *      handset, and A's payout and KYC notifications render on B's lock screen.
 *      Registration therefore revokes any other live row holding the token.
 */
@Injectable()
export class DeviceRegistryService {
  private readonly logger = new Logger(DeviceRegistryService.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  async register(
    subjectType: DeviceSubjectType,
    subjectId: string,
    body: DeviceRegisterRequest,
  ): Promise<{ id: string }> {
    try {
      return await this.upsert(subjectType, subjectId, body);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      // Two registrations of the SAME token can race past each other's revoke
      // step and collide on `uq_devices_push_token` — an index the upsert's
      // `ON CONFLICT` target does not name, so Postgres raises 23505 rather
      // than taking the DO UPDATE branch. One retry resolves the ordinary case
      // (the loser now sees the winner's row and revokes it).
      try {
        return await this.upsert(subjectType, subjectId, body);
      } catch (retryError) {
        if (!isUniqueViolation(retryError)) throw retryError;
        throw new ApiException(
          409,
          ErrorCodes.DEVICE_TOKEN_CONFLICT,
          'This push token is registered to another account — re-mint it and register again',
        );
      }
    }
  }

  private async upsert(
    subjectType: DeviceSubjectType,
    subjectId: string,
    body: DeviceRegisterRequest,
  ): Promise<{ id: string }> {
    return this.db.transaction(async (tx) => {
      if (body.pushToken) {
        // Revoke any OTHER live row holding this token before claiming it.
        await tx
          .update(devices)
          .set({
            revokedAt: new Date(),
            revokedReason: 'token_reassigned',
            pushToken: null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(devices.pushToken, body.pushToken),
              isNull(devices.revokedAt),
              ne(devices.installationId, body.installationId),
            ),
          );
      }

      const [row] = await tx
        .insert(devices)
        .values({
          subjectType,
          subjectId,
          installationId: body.installationId,
          pushToken: body.pushToken,
          platform: body.platform,
          appVersion: body.appVersion ?? null,
          lastSeenAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [devices.subjectType, devices.subjectId, devices.installationId],
          set: {
            pushToken: body.pushToken,
            platform: body.platform,
            appVersion: body.appVersion ?? null,
            lastSeenAt: new Date(),
            // Re-registering after a logout un-revokes: the person signed back
            // in on the same handset, which is the ordinary case, not an attack.
            revokedAt: null,
            revokedReason: null,
            updatedAt: new Date(),
          },
        })
        .returning({ id: devices.id });

      return { id: row!.id };
    });
  }

  /** Explicit unregister — the logout path. Idempotent: unknown installs are a no-op. */
  async unregister(
    subjectType: DeviceSubjectType,
    subjectId: string,
    installationId: string,
    reason = 'logout',
  ): Promise<void> {
    await this.db
      .update(devices)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
        pushToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devices.subjectType, subjectType),
          eq(devices.subjectId, subjectId),
          eq(devices.installationId, installationId),
          isNull(devices.revokedAt),
        ),
      );
  }

  /**
   * Revokes EVERY device for a subject.
   *
   * Called on the session endings a client cannot be relied on to tell us
   * about: suspension, KYC rejection, and account deletion (invariant 73). A
   * logout that never reached the server, an app killed mid-session, or an
   * admin acting while the driver's phone is off would all otherwise leave a
   * live token on a handset whose session has ended — and a push renders on a
   * lock screen without anyone unlocking anything.
   */
  async revokeAllForSubject(
    subjectType: DeviceSubjectType,
    subjectId: string,
    reason: string,
  ): Promise<number> {
    const revoked = await this.db
      .update(devices)
      .set({
        revokedAt: new Date(),
        revokedReason: reason,
        pushToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devices.subjectType, subjectType),
          eq(devices.subjectId, subjectId),
          isNull(devices.revokedAt),
        ),
      )
      .returning({ id: devices.id });

    if (revoked.length > 0) {
      this.logger.log(
        `revoked ${revoked.length} device(s) for ${subjectType}:${subjectId} (${reason})`,
      );
    }
    return revoked.length;
  }

  async list(subjectType: DeviceSubjectType, subjectId: string) {
    return this.db
      .select({
        id: devices.id,
        installationId: devices.installationId,
        platform: devices.platform,
        appVersion: devices.appVersion,
        pushEnabled: sql<boolean>`${devices.pushToken} is not null`,
        lastSeenAt: devices.lastSeenAt,
      })
      .from(devices)
      .where(
        and(
          eq(devices.subjectType, subjectType),
          eq(devices.subjectId, subjectId),
          isNull(devices.revokedAt),
        ),
      );
  }
}
