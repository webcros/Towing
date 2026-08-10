import { Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { SkipThrottling, ThrottleBucket } from '../../common/throttling/throttler.config';
import {
  fleetLoginRequestSchema,
  fleetOtpVerifyRequestSchema,
  type FleetLoginRequest,
  type FleetOtpVerifyRequest,
} from '@towing/api-contracts';
import { ZodBody, ZodQuery } from '../../common/validation/zod.decorators';
import { ApiException } from '../../common/errors/api-exception';
import { AuthService } from './auth.service';
import {
  devOtpQuerySchema,
  refreshRequestSchema,
  type AuthedRequest,
  type DevOtpQuery,
  type RefreshRequest,
} from './auth.types';
import { JwtAuthGuard, Public } from './jwt-auth.guard';
import type { SessionContext } from './token.service';

/**
 * Fleet console auth (§16.4). The guard is declared here rather than relied upon
 * globally so `/fleet/auth/me` is protected regardless of how the integrator
 * wires APP_GUARD; the unauthenticated steps opt out with `@Public()`.
 *
 * The `auth` throttle bucket (5/min) covers the whole controller: credential
 * stuffing and OTP guessing both live on these routes, and the per-account
 * counters in AuthService only bite after an attacker has picked a target.
 */
@Controller('fleet/auth')
@UseGuards(JwtAuthGuard)
@ThrottleBucket('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@ZodBody(fleetLoginRequestSchema) body: FleetLoginRequest) {
    return this.auth.login(body);
  }

  @Public()
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(
    @ZodBody(fleetOtpVerifyRequestSchema) body: FleetOtpVerifyRequest,
    @Req() request: AuthedRequest,
  ) {
    return this.auth.verify(body, sessionContext(request));
  }

  /**
   * `refresh`, not `auth`: a refresh is driven by the access-token TTL rather
   * than by a human, costs no scrypt, and several open console tabs fire it at
   * once. The handler-level tag overrides the class-level one because the guard
   * resolves with `getAllAndOverride([handler, classRef])`.
   */
  @Public()
  @Post('refresh')
  @ThrottleBucket('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@ZodBody(refreshRequestSchema) body: RefreshRequest, @Req() request: AuthedRequest) {
    return this.auth.refresh(body.refreshToken, sessionContext(request));
  }

  /** Public because a client with an expired access token must still be able to sign out. */
  @Public()
  @Post('logout')
  @ThrottleBucket('refresh')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@ZodBody(refreshRequestSchema) body: RefreshRequest): Promise<void> {
    await this.auth.logout(body.refreshToken);
  }

  /**
   * DEVELOPMENT ONLY (`AUTH_DEV_OTP_ECHO`) — the code just issued for a
   * challenge, so a mocks-off browser test can finish the login.
   *
   * A flag-driven 404 rather than a conditionally-registered route, matching
   * how `REALTIME_ENABLED` turns the ticket endpoint into a 503: a route that
   * exists but refuses is far easier to reason about than a route table that
   * changes shape with the environment. Production refuses to boot with the
   * flag set at all.
   *
   * `@SkipThrottling()` because the controller's `auth` bucket is a
   * credential-stuffing defence keyed on the email in the request body, and a
   * GET has no body — so every call here would share one IP-keyed budget of
   * five a minute, which a browser suite exhausts in its fourth test. There is
   * nothing to protect either way: reaching this endpoint at all requires a
   * challenge, which requires the password.
   */
  @Public()
  @Get('dev/otp')
  @SkipThrottling()
  devOtp(@ZodQuery(devOtpQuerySchema) query: DevOtpQuery) {
    return this.auth.devOtp(query.challengeId);
  }

  @Get('me')
  me(@Req() request: AuthedRequest) {
    const auth = request.auth;
    // `fleetId` is optional since Phase 10 (a customer session has no tenant),
    // but this controller is fleet-only, so the guard has already proven one.
    if (!auth?.fleetId) throw ApiException.unauthorized();

    return this.auth.me(auth.fleetId, auth.sub);
  }
}

function sessionContext(request: AuthedRequest): SessionContext {
  return { userAgent: request.headers['user-agent'] ?? null, ip: request.ip ?? null };
}
