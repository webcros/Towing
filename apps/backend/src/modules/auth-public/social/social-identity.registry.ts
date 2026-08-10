import { Inject, Injectable } from '@nestjs/common';
import type { SocialProvider } from '@towing/api-contracts';
import { ApiException } from '../../../common/errors/api-exception';
import { SOCIAL_IDENTITY_PORTS, type SocialIdentityPort } from './social-identity.port';

/**
 * Resolves a provider name to its adapter, refusing disabled ones.
 *
 * Refusing here rather than inside each adapter keeps "is this provider usable"
 * a single check on one code path, so a future provider cannot be added and
 * quietly skip it.
 */
@Injectable()
export class SocialIdentityRegistry {
  private readonly byProvider: ReadonlyMap<SocialProvider, SocialIdentityPort>;

  constructor(@Inject(SOCIAL_IDENTITY_PORTS) ports: readonly SocialIdentityPort[]) {
    this.byProvider = new Map(ports.map((port) => [port.provider, port]));
  }

  for(provider: SocialProvider): SocialIdentityPort {
    const port = this.byProvider.get(provider);

    // 403 rather than 404: the provider is a real, documented option that this
    // deployment has not been given credentials for. A 404 would suggest the
    // client sent something nonsensical.
    if (!port || !port.enabled) {
      throw ApiException.forbidden(`${provider} sign-in is not available`);
    }

    return port;
  }
}
