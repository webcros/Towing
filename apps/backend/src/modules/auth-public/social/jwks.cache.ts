import { createPublicKey, type JsonWebKey } from 'node:crypto';
import { Logger } from '@nestjs/common';

interface JwksResponse {
  keys?: (JsonWebKey & { kid?: string; alg?: string; use?: string })[];
}

/**
 * Fetches and caches a provider's JSON Web Key Set, handing back PEM public keys.
 *
 * WHY THIS IS HAND-ROLLED. `@nestjs/jwt` already wraps `jsonwebtoken`, whose
 * `verifyAsync(token, { publicKey, algorithms, audience, issuer })` does the
 * actual RS256 verification with a per-call key — so the only piece genuinely
 * missing was fetch-and-cache, which is this file. Adding `jose` or
 * `google-auth-library` for it would buy a key cache and a large transitive
 * tree, and the signature verification itself would still be jsonwebtoken's.
 * Same reasoning `password.ts` used choosing `node:crypto` scrypt over bcrypt.
 *
 * KEY ROTATION. Providers rotate signing keys on their own schedule and publish
 * the new one before they use it. An unknown `kid` therefore triggers exactly
 * ONE refetch — enough to pick up a rotation, bounded so a token carrying a
 * garbage `kid` cannot be used to hammer the provider's endpoint.
 */
export class JwksCache {
  private readonly logger = new Logger(JwksCache.name);
  private keys = new Map<string, string>();
  private expiresAt = 0;
  /** Shared so N concurrent logins during a cache miss make ONE request. */
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly minTtlSeconds: number,
    private readonly timeoutMs: number,
  ) {}

  /** The PEM for a `kid`, or null if the provider does not publish it. */
  async publicKeyFor(kid: string): Promise<string | null> {
    if (this.fresh()) {
      const cached = this.keys.get(kid);
      if (cached) return cached;
      // Fresh cache, unknown kid: a rotation the cache has not seen yet.
    }

    await this.refresh();
    return this.keys.get(kid) ?? null;
  }

  private fresh(): boolean {
    return this.keys.size > 0 && Date.now() < this.expiresAt;
  }

  private async refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetchKeys().finally(() => {
      this.inFlight = null;
    });

    return this.inFlight;
  }

  private async fetchKeys(): Promise<void> {
    const response = await fetch(this.url, {
      // §19.3's external-call budget. Without it a hung provider holds a request
      // thread until the client gives up, on the login path of both apps.
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { accept: 'application/json' },
    }).catch((error: unknown) => {
      throw new Error(`JWKS fetch failed for ${this.url}: ${String(error)}`);
    });

    if (!response.ok) {
      throw new Error(`JWKS fetch returned ${response.status} for ${this.url}`);
    }

    const body = (await response.json()) as JwksResponse;
    const next = new Map<string, string>();

    for (const jwk of body.keys ?? []) {
      // Signing keys only. An encryption key in the set is not a key anything
      // should be verifying a token against.
      if (!jwk.kid || (jwk.use && jwk.use !== 'sig')) continue;

      try {
        // node:crypto imports a JWK directly; the PEM is what jsonwebtoken wants.
        next.set(jwk.kid, createPublicKey({ key: jwk, format: 'jwk' }).export({
          type: 'spki',
          format: 'pem',
        }) as string);
      } catch (error) {
        // One malformed key must not poison the whole set.
        this.logger.warn(`Skipping unusable JWK ${jwk.kid}: ${String(error)}`);
      }
    }

    if (next.size === 0) throw new Error(`JWKS at ${this.url} published no usable signing keys`);

    this.keys = next;
    // Honour the provider's own cache header when it is longer than our floor —
    // Google's is typically several hours and refetching sooner is pure waste.
    this.expiresAt = Date.now() + Math.max(this.minTtlSeconds, maxAgeOf(response)) * 1_000;
  }
}

function maxAgeOf(response: Response): number {
  const match = /max-age=(\d+)/i.exec(response.headers.get('cache-control') ?? '');
  const seconds = match?.[1] ? Number.parseInt(match[1], 10) : 0;

  // Capped at a day: a provider advertising a very long TTL must not leave a
  // revoked key usable here for weeks.
  return Number.isFinite(seconds) ? Math.min(seconds, 86_400) : 0;
}
