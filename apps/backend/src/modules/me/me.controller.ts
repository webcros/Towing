import { Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { customerProfileUpdateSchema, type CustomerProfileUpdate } from '@towing/api-contracts';
import { ApiException } from '../../common/errors/api-exception';
import { ZodBody } from '../../common/validation/zod.decorators';
import type { AuthedRequest } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Realms } from '../auth/realm.decorator';
import { MeService } from './me.service';

/**
 * The customer's own profile (Phase 12, §9.1.3/§16.2). Customer-only: a
 * driver has no `users` row to read here — `account-privacy.controller.ts`
 * next to this file is what serves both realms.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
@Realms('customer')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  getProfile(@Req() request: AuthedRequest) {
    return this.me.getProfile(customerId(request));
  }

  @Put()
  updateProfile(
    @ZodBody(customerProfileUpdateSchema) body: CustomerProfileUpdate,
    @Req() request: AuthedRequest,
  ) {
    return this.me.updateProfile(customerId(request), body);
  }
}

export function customerId(request: AuthedRequest): string {
  const auth = request.auth;
  if (!auth) throw ApiException.unauthorized();
  return auth.sub;
}
