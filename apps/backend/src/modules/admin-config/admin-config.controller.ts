import { Controller, Get, HttpCode, HttpStatus, Put, Req, UseGuards } from '@nestjs/common';
import {
  adminCommissionUpdateSchema,
  adminDispatchConfigUpdateSchema,
  adminPricingUpdateSchema,
  type AdminDispatchConfig,
  type AdminDispatchConfigUpdate,
  type AdminCommissionConfig,
  type AdminCommissionUpdate,
  type AdminPricingConfig,
  type AdminPricingUpdate,
  type CommissionHistoryEntry,
} from '@towing/api-contracts';
import { ApiException } from '../../common/errors/api-exception';
import { ThrottleBucket } from '../../common/throttling/throttler.config';
import { ZodBody } from '../../common/validation/zod.decorators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Realms, Roles } from '../auth/realm.decorator';
import type { AuthedRequest } from '../auth/auth.types';
import { sessionContextFrom } from '../auth/token.service';
import { AdminConfigService } from './admin-config.service';
import { AdminDispatchService } from './admin-dispatch.service';

/**
 * §16.5 pricing and commission configuration.
 *
 * `super_admin | finance` ONLY — this is the first real user of the `finance`
 * sub-role, which until now appeared in nothing but negative RBAC tests.
 * `operations` and `support` are deliberately excluded: approving a driver's
 * documents and re-rating every future booking on the platform are not the same
 * authority, and §4.2's matrix separates them.
 *
 * `@ThrottleBucket('money')` on both writes, matching the precedent set by the
 * KYC decision route — an audited admin write that changes economics belongs in
 * the 20/min bucket, not the 300/min read one.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard)
@Realms('admin')
export class AdminConfigController {
  constructor(
    private readonly config: AdminConfigService,
    private readonly dispatch: AdminDispatchService,
  ) {}

  @Get('pricing')
  @Roles('super_admin', 'finance')
  getPricing(): Promise<AdminPricingConfig> {
    return this.config.getPricing();
  }

  @Put('pricing')
  @Roles('super_admin', 'finance')
  @ThrottleBucket('money')
  @HttpCode(HttpStatus.OK)
  updatePricing(
    @ZodBody(adminPricingUpdateSchema) body: AdminPricingUpdate,
    @Req() request: AuthedRequest,
  ): Promise<AdminPricingConfig> {
    return this.config.updatePricing(adminId(request), body, sessionContextFrom(request));
  }

  @Get('commission')
  @Roles('super_admin', 'finance')
  getCommission(): Promise<AdminCommissionConfig> {
    return this.config.getCommission();
  }

  @Put('commission')
  @Roles('super_admin', 'finance')
  @ThrottleBucket('money')
  @HttpCode(HttpStatus.OK)
  updateCommission(
    @ZodBody(adminCommissionUpdateSchema) body: AdminCommissionUpdate,
    @Req() request: AuthedRequest,
  ): Promise<AdminCommissionConfig> {
    return this.config.updateCommission(adminId(request), body, sessionContextFrom(request));
  }

  /**
   * §16.5's dispatch configuration (Phase 17).
   *
   * `super_admin | operations`, NOT `finance` — and that split is the point of
   * §4.2's matrix. Pricing and commission are money decisions and belong to
   * finance; a radius ladder and a stale-ping threshold are operational levers
   * pulled during an incident by whoever is watching the map. The two routes on
   * this controller therefore have different role sets, which is the first time
   * that has been true.
   */
  @Get('dispatch-config')
  @Roles('super_admin', 'operations')
  getDispatch(): Promise<AdminDispatchConfig> {
    return this.dispatch.get();
  }

  @Put('dispatch-config')
  @Roles('super_admin', 'operations')
  @ThrottleBucket('money')
  @HttpCode(HttpStatus.OK)
  updateDispatch(
    @ZodBody(adminDispatchConfigUpdateSchema) body: AdminDispatchConfigUpdate,
    @Req() request: AuthedRequest,
  ): Promise<AdminDispatchConfig> {
    return this.dispatch.update(adminId(request), body, sessionContextFrom(request));
  }

  /** §3.3 "versioned + audited" — the version half, readable. */
  @Get('commission/history')
  @Roles('super_admin', 'finance')
  commissionHistory(): Promise<CommissionHistoryEntry[]> {
    return this.config.commissionHistory();
  }
}

// Local to each admin controller, matching `admin-drivers.controller.ts`.
function adminId(request: AuthedRequest): string {
  const auth = request.auth;
  if (!auth) throw ApiException.unauthorized();
  return auth.sub;
}
