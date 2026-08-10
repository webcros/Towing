import { Inject, Injectable } from '@nestjs/common';
import type { SocialProvider } from '@towing/api-contracts';
import { ApiException } from '../../../common/errors/api-exception';
import { ENV, type Env } from '../../../config/env';
import type { SocialIdentityPort, SocialProfile } from './social-identity.port';

/**
 * Sign in with Apple — SHIPS DARK, DELIBERATELY.
 *
 * The port and the `social_identities` row shape cover Apple from day one, so
 * enabling it in Phase 13 is an implementation plus a flag rather than a
 * migration. What is missing is not code but credentials: Apple requires a
 * Services ID, a Team ID and a signing key from a paid Apple Developer account,
 * and organisation enrolment (which needs a D-U-N-S number) only STARTS at this
 * phase and takes weeks.
 *
 * Shipping an Apple code path that has never once executed against Apple's
 * servers would be worse than shipping none: it would look finished in review,
 * and its first real execution would be a user failing to log in. So this throws
 * and `assertProductionSafety` refuses to boot production with
 * `APPLE_LOGIN_ENABLED` set.
 *
 * App Store Guideline 4.8 makes Apple sign-in mandatory alongside Google, so
 * this MUST be real before the first production build (Phase 21) — Phase 13 is
 * where it happens, with `GoogleIdentityAdapter` as the template: Apple
 * publishes an equivalent JWKS at https://appleid.apple.com/auth/keys, and the
 * differences are a client-secret JWT signed with the ES256 key, and a `name`
 * that arrives only on the very first authorisation and must be stored then.
 */
@Injectable()
export class AppleIdentityAdapter implements SocialIdentityPort {
  readonly provider: SocialProvider = 'apple';

  constructor(@Inject(ENV) private readonly env: Env) {}

  get enabled(): boolean {
    // Always false in practice — production refuses to boot with the flag on,
    // and there is no implementation behind it. The flag exists so Phase 13 can
    // turn it on in one place once `verify()` is real.
    return this.env.APPLE_LOGIN_ENABLED;
  }

  async verify(): Promise<SocialProfile> {
    throw ApiException.forbidden('Sign in with Apple is not available yet');
  }
}
