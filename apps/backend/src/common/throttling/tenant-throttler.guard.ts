import { createHash } from 'node:crypto';
import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import { MetricsService } from '../observability/metrics.service';
import { ThrottleBucket, type ThrottleBucketName } from './throttler.config';

/**
 * Makes a rate limit mean "per tenant", not "per source address".
 *
 * Two defects in the stock guard, both fixed here:
 *
 * 1. `getTracker` returns `req.ip`. Every console request arrives through the
 *    Next BFF, so behind it every fleet in the system shares ONE bucket — the
 *    busiest tenant rate-limits everybody else, and a single attacker rate-limits
 *    the whole product.
 * 2. `generateKey` hashes `${ClassName}-${handlerName}-${name}-${suffix}`, so a
 *    "120/min" bucket is really 120/min PER HANDLER. With 21 GET handlers that
 *    is ~2,500/min — not a rate limit, a rounding error. The class and handler
 *    are dropped below, which is why the `reads` limit was raised at the same
 *    time: the number got roughly 21x stricter without changing.
 *
 * WHY THE TOKEN IS VERIFIED HERE. Global guards run before controller-level
 * ones, so `JwtAuthGuard` has not populated `req.auth` yet. The alternative —
 * reading the fleet id out of an unverified JWT body, or trusting a header — is
 * evadable by anyone willing to edit the value they send, and a tracker an
 * attacker chooses is fail-open with extra steps. One HS256 verification is
 * ~10–30 µs of CPU and no I/O, which is nothing against the database round trips
 * already on this path.
 */
@Injectable()
export class TenantThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly metrics: MetricsService,
  ) {
    super(options, storage, reflector);
  }

  /**
   * Counted here rather than inferred from `http_request_duration_seconds`'s
   * 429s: that histogram is labelled by route, and the question worth asking
   * about a rate limit is which BUCKET is biting — which is what tells you
   * whether a limit is wrong or a client is misbehaving.
   */
  protected async throwThrottlingException(
    context: ExecutionContext,
    detail: Parameters<ThrottlerGuard['throwThrottlingException']>[1],
  ): Promise<void> {
    this.metrics.observeThrottled(this.bucketOf(context) ?? 'reads');
    return super.throwThrottlingException(context, detail);
  }

  /**
   * The identity a budget belongs to, per bucket.
   *
   * ⚠ The resolved tenant is cached on `req.throttleTenant` and NEVER on
   * `req.auth`. `@CurrentFleet()` and `FleetScopeGuard` trust `req.auth`
   * absolutely; populating it from here would mean a request that reaches a
   * handler with the throttler skipped (`THROTTLE_DISABLED`, `@SkipThrottle()`,
   * the webhook controller) carries a differently-populated auth object than one
   * that does not. That is the kind of difference that becomes a tenancy bug.
   */
  protected async getTracker(req: TrackedRequest, context?: ExecutionContext): Promise<string> {
    // `context` is optional only to satisfy the base class, whose method is
    // declared as taking the request alone. The guard always passes both.
    const bucket = context ? this.bucketOf(context) : undefined;

    if (bucket === 'auth') {
      // Credential stuffing targets an ACCOUNT, so key on the account. An IP is
      // both too broad (one office shares it) and too narrow (an attacker
      // rotates it), whereas the identifier is the one value the attack cannot
      // vary.
      const email = typeof req.body?.email === 'string' ? req.body.email : null;
      if (email) return `e:${sha256(email.trim().toLowerCase())}`;

      // The customer and driver realms have no email — they log in by phone.
      // Without this branch every OTP send in the deployment shares one `ip:`
      // bucket behind the BFF and carrier NAT, so the account-targeting
      // property above simply would not exist for two of the four realms.
      const mobile = typeof req.body?.mobile === 'string' ? req.body.mobile : null;
      if (mobile) return `m:${sha256(mobile.trim())}`;
    }

    if (bucket === 'refresh') {
      // Per session. A forged value gets its own bucket, which costs nothing:
      // it is 401'd on the same request.
      const token = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : null;
      if (token) return `r:${sha256(token)}`;
    }

    if (req.throttleTenant) return req.throttleTenant;

    const tracker = this.subjectFromBearer(req) ?? `ip:${req.ip ?? 'unknown'}`;
    req.throttleTenant = tracker;
    return tracker;
  }

  /**
   * Just the tracker — deliberately without the class and handler names the base
   * implementation hashes in, so one bucket is one budget across every route
   * that shares it rather than one budget per endpoint.
   *
   * The bucket name is NOT added here: `RedisThrottlerStorage` already
   * namespaces by throttler, so doing both yields `thr:reads:reads:f:…`. The
   * final key is `thr:reads:f:<fleetId>` — left readable rather than hashed,
   * because `redis-cli --scan --pattern 'thr:reads:f:*'` is worth a great deal
   * when a customer says they are being rate-limited.
   */
  protected generateKey(_context: ExecutionContext, suffix: string, _name: string): string {
    return suffix;
  }

  private bucketOf(context: ExecutionContext): ThrottleBucketName | undefined {
    return this.reflector.getAllAndOverride(ThrottleBucket, [
      context.getHandler(),
      context.getClass(),
    ]);
  }

  /**
   * The budget owner for an authenticated request, or null to fall back to IP.
   *
   * Every realm gets its own prefix. Before Phase 10 this read `fleet_id` only,
   * so a driver or customer token produced nothing and collapsed into the
   * shared `ip:` bucket — which behind the BFF and carrier-grade NAT means one
   * bucket for every mobile client in the deployment, and one busy driver rate
   * limiting the rest.
   *
   * `fleet_owner` is an EXPLICIT case rather than a fallthrough on the presence
   * of `fleet_id`: a fleet token that somehow lost its binding must not silently
   * land in the shared bucket. It gets `f:<sub>` and its own budget, and the
   * guard 403s it a moment later.
   */
  private subjectFromBearer(req: TrackedRequest): string | null {
    const header = req.headers?.authorization;
    if (!header) return null;

    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;

    try {
      // Sync, not verifyAsync: this is pure CPU and an extra promise per request
      // buys nothing. An invalid token falls through to the IP bucket and is
      // rejected a guard later anyway.
      const claims = this.jwt.verify<{ role?: unknown; sub?: unknown; fleet_id?: unknown }>(token);
      const sub = typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;

      switch (claims.role) {
        case 'fleet_owner': {
          // The tenant, not the user: several owners of one fleet share a budget,
          // which is the unit the `reads` limit was sized against.
          const fleetId = typeof claims.fleet_id === 'string' ? claims.fleet_id : null;
          return fleetId ? `f:${fleetId}` : sub && `f:${sub}`;
        }
        case 'driver':
          return sub && `d:${sub}`;
        case 'customer':
          return sub && `c:${sub}`;
        case 'admin':
          return sub && `a:${sub}`;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}

interface TrackedRequest {
  ip?: string;
  headers?: { authorization?: string };
  body?: { email?: unknown; mobile?: unknown; refreshToken?: unknown };
  throttleTenant?: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}
