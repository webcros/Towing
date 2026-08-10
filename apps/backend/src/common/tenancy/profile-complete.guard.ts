import { CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { HttpStatus } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { ErrorCodes } from '@towing/api-contracts';
import { ApiException } from '../errors/api-exception';
import { CacheService } from '../cache/cache.service';
import { DB_READER, type DatabaseReader } from '../../db/db.module';
import type { AuthedRequest } from '../../modules/auth/auth.types';

/**
 * §9.3.1's AC: "account usable only after business profile completes".
 *
 * **Scoped to the money paths.** It guards `POST /fleet/payouts` and
 * `POST /fleet/settings/payout-account` — the two routes where an incomplete
 * profile actually causes harm — and nothing else. A fleet that has not
 * finished onboarding can still add trucks, invite drivers and watch the map;
 * it just cannot move money out.
 *
 * That is a narrower reading than blocking every mutation, and a deliberate
 * one: this is the point where the missing GSTIN/address is genuinely required
 * (Route needs them to open a linked account), and blocking the rest of the
 * console would turn a first-run nudge into a wall.
 *
 * Applied per-route with `@UseGuards(ProfileCompleteGuard)`, not globally with
 * an allowlist — an allowlist is a list of things somebody has to remember to
 * add to, and forgetting fails CLOSED on an unrelated endpoint.
 */
@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  /** Short: this is read on a money mutation, and it must reflect a save quickly. */
  private static readonly TTL_SECONDS = 60;

  constructor(
    @Inject(DB_READER) private readonly db: DatabaseReader,
    private readonly cache: CacheService,
    private readonly reflector: Reflector,
  ) {}

  static cacheKey(fleetId: string): string {
    return `fleet:profile:${fleetId}`;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const fleetId = request.auth?.fleetId;

    // No fleet on the request means some other guard already decided this is
    // not a fleet-scoped route (or will reject it). Not our call to make.
    if (!fleetId) return true;

    const state = await this.cache.getOrSet(
      ProfileCompleteGuard.cacheKey(fleetId),
      ProfileCompleteGuard.TTL_SECONDS,
      () => this.load(fleetId),
    );

    if (state.profileComplete) return true;

    throw new ApiException(
      HttpStatus.FORBIDDEN,
      ErrorCodes.PROFILE_INCOMPLETE,
      'Complete your business profile before moving money',
      { onboardingStep: state.onboardingStep, missing: state.missing },
    );
  }

  private async load(fleetId: string): Promise<{
    profileComplete: boolean;
    onboardingStep: string;
    missing: string[];
  }> {
    const rows = (await this.db.execute(sql`
      select profile_completed_at, onboarding_step, business_name, address
        from fleets where id = ${fleetId}::uuid
    `)) as unknown as Array<{
      profile_completed_at: Date | null;
      onboarding_step: string;
      business_name: string | null;
      address: string | null;
    }>;

    const row = rows[0];
    if (!row) {
      // A verified token naming a fleet that does not exist. Fail closed.
      return { profileComplete: false, onboardingStep: 'profile', missing: ['businessName'] };
    }

    const missing: string[] = [];
    if (!row.business_name?.trim()) missing.push('businessName');
    // §9.3.1 makes GSTIN explicitly optional, so address is what decides.
    if (!row.address?.trim()) missing.push('address');

    return {
      profileComplete: row.profile_completed_at !== null,
      onboardingStep: row.onboarding_step,
      missing,
    };
  }
}
