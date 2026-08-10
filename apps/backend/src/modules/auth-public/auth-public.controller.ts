import { Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import {
  otpSendRequestSchema,
  otpVerifyRequestSchema,
  socialLoginRequestSchema,
  type OtpSendRequest,
  type OtpVerifyRequest,
  type SocialLoginRequest,
} from '@towing/api-contracts';
import { SkipThrottling, ThrottleBucket } from '../../common/throttling/throttler.config';
import { ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import {
  devOtpQuerySchema,
  refreshRequestSchema,
  type AuthedRequest,
  type DevOtpQuery,
  type RefreshRequest,
} from '../auth/auth.types';
import { Public } from '../auth/jwt-auth.guard';
import type { SessionContext } from '../auth/token.service';
import { AuthPublicService } from './auth-public.service';

/**
 * Customer and driver auth (§9.1, §9.2, §16.1). Every route is unauthenticated
 * by definition — a session is what they produce.
 *
 * ONE CONTROLLER FOR TWO REALMS. The flows are identical apart from which table
 * the subject lives in, and the realm is a field on the request rather than a
 * path segment, so `/v1/customer/auth/*` and `/v1/driver/auth/*` would have been
 * two copies of the same file. The realm is still carried end to end: it is on
 * the challenge row, on the refresh row and derived from the token's role.
 *
 * The `auth` bucket (5/min) covers the class; `TenantThrottlerGuard` keys it on
 * the mobile number, and `OtpRateService` adds the longer per-number window that
 * a burst limit cannot express.
 */
@Controller('auth')
@ThrottleBucket('auth')
export class AuthPublicController {
  constructor(private readonly auth: AuthPublicService) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  sendOtp(@ZodBody(otpSendRequestSchema) body: OtpSendRequest) {
    return this.auth.sendOtp(body);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  verifyOtp(@ZodBody(otpVerifyRequestSchema) body: OtpVerifyRequest, @Req() request: AuthedRequest) {
    return this.auth.verifyOtp(body, sessionContext(request));
  }

  @Public()
  @Post('social')
  @HttpCode(HttpStatus.OK)
  social(
    @ZodBody(socialLoginRequestSchema) body: SocialLoginRequest,
    @Req() request: AuthedRequest,
  ) {
    return this.auth.socialLogin(body, sessionContext(request));
  }

  /**
   * Its own bucket, as on the fleet console: refresh is driven by the 15-minute
   * access-token TTL rather than by a human, so sharing the login bucket would
   * log people out under ordinary use.
   */
  @Public()
  @Post('refresh')
  @ThrottleBucket('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@ZodBody(refreshRequestSchema) body: RefreshRequest, @Req() request: AuthedRequest) {
    return this.auth.refresh(body.refreshToken, sessionContext(request));
  }

  @Public()
  @Post('logout')
  @ThrottleBucket('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@ZodBody(refreshRequestSchema) body: RefreshRequest): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  /** Development only — 404s unless `AUTH_DEV_OTP_ECHO`. See the service. */
  @Public()
  @Get('dev/otp')
  @SkipThrottling()
  devOtp(@ZodQuery(devOtpQuerySchema) query: DevOtpQuery) {
    return this.auth.devOtp(query.challengeId);
  }
}

function sessionContext(request: AuthedRequest): SessionContext {
  return { userAgent: request.headers['user-agent'] ?? null, ip: request.ip ?? null };
}
