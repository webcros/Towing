import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SocialProvider } from '@towing/api-contracts';
import { ApiException } from '../../../common/errors/api-exception';
import { ENV, type Env } from '../../../config/env';
import { JwksCache } from './jwks.cache';
import type { SocialIdentityPort, SocialProfile } from './social-identity.port';

/** Apple mints under exactly one issuer, unlike Google's two spellings. */
const ISSUERS: [string, ...string[]] = ['https://appleid.apple.com'];

interface AppleIdTokenPayload {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  is_private_email?: unknown;
}

/**
 * Sign in with Apple (§9.1). App Store Guideline 4.8 makes it mandatory
 * alongside Google before the first production build.
 *
 * ⚠ REAL BUT NEVER EXECUTED AGAINST APPLE. Phase 13 replaced the throwing stub
 * with a genuine verifier — the same `JwksCache` + `@nestjs/jwt` construction
 * `GoogleIdentityAdapter` uses, against Apple's published JWKS — but no token
 * Apple actually minted has ever passed through it, because organisation
 * enrolment (D-U-N-S, weeks) has not completed. Treat every line below as
 * reviewed, not as proven.
 *
 * What changed relative to the stub, and why it is not simply "shipping an
 * unexecuted path" (which this repo refuses elsewhere): the code is now
 * verifiable in isolation. `apple-identity.adapter.spec.ts` mints tokens with a
 * real ES256 keypair, publishes a real JWKS, and asserts the security
 * properties — including the algorithm-confusion attack. What CANNOT be
 * asserted here is that Apple's real tokens have the shape their documentation
 * describes, and that is exactly what the docstring says.
 *
 * THREE DIFFERENCES FROM GOOGLE, all load-bearing:
 *
 *  1. **ES256, not RS256.** The algorithm list is a SECURITY CONTROL, not a
 *     detail: without pinning it, an attacker signs their own payload with
 *     HS256 using this service's `JWT_ACCESS_SECRET` and has it accepted as an
 *     Apple identity. Same reasoning, same test, different curve.
 *  2. **`email_verified` arrives as the STRING `"true"`**, not a boolean, in
 *     Apple's tokens. A `=== true` check silently marks every Apple email
 *     unverified.
 *  3. **`name` is not in the token at all.** Apple returns it once, in the
 *     authorisation response body, on the very first authorisation only —
 *     never again, and never in the ID token. So `name` here is always null and
 *     the client must send it separately at first sign-in or it is lost
 *     forever.
 *
 * `APPLE_LOGIN_ENABLED` still defaults off and `assertProductionSafety` still
 * refuses to boot production with it on and no `APPLE_CLIENT_IDS` — an unpinned
 * audience would accept any Apple ID token from any app in the world.
 */
@Injectable()
export class AppleIdentityAdapter implements SocialIdentityPort {
  readonly provider: SocialProvider = 'apple';
  private readonly logger = new Logger(AppleIdentityAdapter.name);
  private readonly jwks: JwksCache;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
  ) {
    this.jwks = new JwksCache(
      env.APPLE_JWKS_URL,
      env.APPLE_JWKS_CACHE_SECONDS,
      env.APPLE_JWKS_TIMEOUT_MS,
    );
  }

  /**
   * TWO conditions, not one. The flag alone is not enough — without client ids
   * there is no `aud` to pin, and an unpinned audience is worse than no Apple
   * sign-in at all. Same rule `GoogleIdentityAdapter.enabled` enforces.
   */
  get enabled(): boolean {
    return this.env.APPLE_LOGIN_ENABLED && this.env.APPLE_CLIENT_IDS.length > 0;
  }

  async verify(idToken: string): Promise<SocialProfile> {
    if (!this.enabled) {
      throw ApiException.forbidden('Sign in with Apple is not configured');
    }

    const kid = kidOf(idToken);
    if (!kid) throw ApiException.unauthorized('Apple token header is malformed');

    let publicKey: string | null;
    try {
      publicKey = await this.jwks.publicKeyFor(kid);
    } catch (error) {
      // A provider outage is not the caller's fault and must not read as "your
      // token is bad" — the client should retry, not re-authenticate.
      this.logger.error(`Apple JWKS unavailable: ${String(error)}`);
      throw new ApiException(503, 'service_unavailable', 'Apple sign-in is briefly unavailable');
    }

    if (!publicKey) throw ApiException.unauthorized('Apple token was signed by an unknown key');

    // Non-empty by construction — `enabled` is exactly this check — but spelled
    // as a tuple because jsonwebtoken types an empty `audience` as "accept
    // any", which is the failure the option exists to prevent.
    const [firstClientId, ...otherClientIds] = this.env.APPLE_CLIENT_IDS;
    const audience: [string, ...string[]] = [firstClientId!, ...otherClientIds];

    let payload: AppleIdTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AppleIdTokenPayload>(idToken, {
        publicKey,
        algorithms: ['ES256'],
        audience,
        issuer: ISSUERS,
        clockTolerance: 30,
      });
    } catch {
      throw ApiException.unauthorized('Sign in with Apple could not be verified');
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw ApiException.unauthorized('Apple token carries no subject');
    }

    const email = typeof payload.email === 'string' ? payload.email : null;
    // Apple sends `"true"`/`"false"` as STRINGS. Accepting both spellings
    // rather than only the boolean, because a `=== true` check would mark
    // every real Apple email unverified — and Private Relay addresses, which
    // most users get, are verified by construction.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';

    return {
      provider: 'apple',
      subject: payload.sub,
      email: emailVerified ? email : null,
      emailVerified,
      // Never present in an Apple ID token — see the class docstring.
      name: null,
      pictureUrl: null,
    };
  }
}

/**
 * The `kid` from the JOSE header, without verifying anything.
 *
 * Safe for the same reason it is safe in the Google adapter: the only thing
 * taken from an unverified header is a key IDENTIFIER, which selects which
 * published public key to check the signature against. A hostile value simply
 * fails that check.
 */
function kidOf(token: string): string | null {
  const [encodedHeader] = token.split('.');
  if (!encodedHeader) return null;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      kid?: unknown;
    };
    return typeof header.kid === 'string' ? header.kid : null;
  } catch {
    return null;
  }
}
