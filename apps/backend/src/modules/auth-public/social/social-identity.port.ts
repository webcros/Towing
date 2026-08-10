import type { SocialProvider } from '@towing/api-contracts';

/**
 * A verified identity assertion from an external provider.
 *
 * `subject` is the provider's own stable `sub` claim and is the ONLY identifier
 * bound to an account. Email deliberately is not: Google addresses can change
 * hands, and trusting an unverified one would let anyone who can set
 * `email: someone@else` on their own provider account take over that person's
 * login here.
 */
export interface SocialProfile {
  provider: SocialProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  pictureUrl: string | null;
}

/**
 * Verification of a provider ID token (§9.1 social sign-in).
 *
 * A port for the usual reason — the Apple implementation cannot be written
 * against a real provider yet, and this is the seam that lets it ship disabled
 * without the calling code knowing. `enabled` is part of the interface rather
 * than a config lookup at the call site so "is this provider usable" has exactly
 * one answer, computed where the credentials are known.
 */
export interface SocialIdentityPort {
  readonly provider: SocialProvider;
  readonly enabled: boolean;

  /**
   * Throws `ApiException.unauthorized` on ANY failure — bad signature, wrong
   * audience, wrong issuer, expired, unverified email. Never returns partial
   * trust: there is no useful "probably this person".
   */
  verify(idToken: string): Promise<SocialProfile>;
}

/** DI token for the array of registered providers. */
export const SOCIAL_IDENTITY_PORTS = Symbol('SOCIAL_IDENTITY_PORTS');
