import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SocialProvider } from '@towing/api-contracts';
import { ApiException } from '../../../common/errors/api-exception';
import { ENV, type Env } from '../../../config/env';
import { JwksCache } from './jwks.cache';
import type { SocialIdentityPort, SocialProfile } from './social-identity.port';

/**
 * Google mints tokens under both spellings and treats them as equivalent.
 * Typed as a non-empty tuple because that is what jsonwebtoken's `issuer`
 * option requires — an empty list would mean "accept any issuer".
 */
const ISSUERS: [string, ...string[]] = ['accounts.google.com', 'https://accounts.google.com'];

interface GoogleIdTokenPayload {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  picture?: unknown;
}

/**
 * Verifies a Google ID token (§9.1).
 *
 * Zero new dependencies: `JwksCache` fetches the signing keys and `@nestjs/jwt`
 * — already a dependency — performs the RS256 verification with a per-call
 * public key.
 *
 * THE ALGORITHM LIST IS A SECURITY CONTROL, NOT A DETAIL. `algorithms: ['RS256']`
 * is what stops an attacker signing their own payload with HS256 using this
 * service's own `JWT_ACCESS_SECRET` and having it accepted as a Google
 * identity — the classic algorithm-confusion attack, and the reason
 * `google-identity.adapter.spec.ts` tests exactly that token.
 *
 * The audience list matters just as much: without it, ANY valid Google ID token
 * from ANY application in the world would authenticate here as that user.
 */
@Injectable()
export class GoogleIdentityAdapter implements SocialIdentityPort {
  readonly provider: SocialProvider = 'google';
  private readonly logger = new Logger(GoogleIdentityAdapter.name);
  private readonly jwks: JwksCache;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly jwt: JwtService,
  ) {
    this.jwks = new JwksCache(
      env.GOOGLE_JWKS_URL,
      env.GOOGLE_JWKS_CACHE_SECONDS,
      env.GOOGLE_JWKS_TIMEOUT_MS,
    );
  }

  /**
   * No client ids configured means no audience to pin, and an unpinned audience
   * is worse than no Google sign-in at all.
   */
  get enabled(): boolean {
    return this.env.GOOGLE_OAUTH_CLIENT_IDS.length > 0;
  }

  async verify(idToken: string): Promise<SocialProfile> {
    if (!this.enabled) {
      throw ApiException.forbidden('Google sign-in is not configured');
    }

    const kid = kidOf(idToken);
    if (!kid) throw ApiException.unauthorized('Google token header is malformed');

    let publicKey: string | null;
    try {
      publicKey = await this.jwks.publicKeyFor(kid);
    } catch (error) {
      // A provider outage is not the caller's fault and must not read as "your
      // token is bad" — the client should retry, not re-authenticate.
      this.logger.error(`Google JWKS unavailable: ${String(error)}`);
      throw new ApiException(503, 'service_unavailable', 'Google sign-in is briefly unavailable');
    }

    if (!publicKey) throw ApiException.unauthorized('Google token was signed by an unknown key');

    // Non-empty by construction — `enabled` above is exactly this check — but
    // spelled as a tuple because jsonwebtoken types an empty `audience` as
    // "accept any", which is the failure this option exists to prevent.
    const [firstClientId, ...otherClientIds] = this.env.GOOGLE_OAUTH_CLIENT_IDS;
    const audience: [string, ...string[]] = [firstClientId!, ...otherClientIds];

    let payload: GoogleIdTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<GoogleIdTokenPayload>(idToken, {
        publicKey,
        algorithms: ['RS256'],
        audience,
        issuer: ISSUERS,
        // Signature, exp, aud and iss are all checked here; `clockTolerance`
        // covers ordinary device clock skew without widening the window enough
        // to matter for a token that lives an hour.
        clockTolerance: 30,
      });
    } catch {
      throw ApiException.unauthorized('Google sign-in could not be verified');
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw ApiException.unauthorized('Google token carries no subject');
    }

    const email = typeof payload.email === 'string' ? payload.email : null;
    const emailVerified = payload.email_verified === true;

    // An unverified Google email is a claim, not a fact. It is carried through
    // as `false` rather than rejected — the account is keyed on `sub`, so an
    // unverified address costs nothing as long as nothing later trusts it.
    return {
      provider: 'google',
      subject: payload.sub,
      email: emailVerified ? email : null,
      emailVerified,
      name: typeof payload.name === 'string' ? payload.name : null,
      pictureUrl: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }
}

/**
 * The `kid` from the JOSE header, without verifying anything.
 *
 * Reading an unverified header is safe here precisely because the only thing
 * taken from it is a key IDENTIFIER — it selects which published public key to
 * check the signature against, and a wrong or hostile value simply fails that
 * check. Nothing else in this file reads the header.
 */
function kidOf(token: string): string | null {
  const [encodedHeader] = token.split('.');
  if (!encodedHeader) return null;

  try {
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8')) as {
      kid?: unknown;
      alg?: unknown;
    };
    // Reject non-RS256 before touching the key set. Redundant with the
    // `algorithms` option below it, and deliberately so — this is the control
    // that an attacker has to get past twice.
    if (header.alg !== 'RS256') return null;
    return typeof header.kid === 'string' && header.kid.length > 0 ? header.kid : null;
  } catch {
    return null;
  }
}
