import { generateKeyPairSync, type KeyObject } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv, type Env } from '../../../config/env';
import { AppleIdentityAdapter } from './apple-identity.adapter';

const CLIENT_ID = 'in.mitow.customer';
const JWKS_URL = 'https://appleid.test/auth/keys';
const ISSUER = 'https://appleid.apple.com';

/**
 * Apple ID-token verification against a stubbed JWKS — the exact shape of
 * `google-identity.adapter.spec.ts`, because the adapters differ only in curve,
 * issuer and two payload quirks.
 *
 * ⚠ WHAT THIS PROVES AND WHAT IT DOES NOT. It proves the verifier rejects
 * everything it must reject and accepts a correctly-signed token — against
 * tokens minted HERE, with a keypair generated HERE. It does NOT prove Apple's
 * real tokens have the shape their documentation describes, because no Apple
 * Developer account exists and none has ever been fetched. That gap is the
 * reason `APPLE_LOGIN_ENABLED` still defaults off.
 *
 * The assertion that matters most is the algorithm-confusion one: without an
 * explicit `algorithms: ['ES256']`, an attacker signs their own payload with
 * HS256 using this service's own `JWT_ACCESS_SECRET` and jsonwebtoken verifies
 * it against the "public key" treated as an HMAC secret. That turns social
 * sign-in into "log in as anyone" (invariant 51, for Google's RS256).
 */
describe('AppleIdentityAdapter', () => {
  let env: Env;
  let privateKey: KeyObject;
  let publicJwk: Record<string, unknown>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    // P-256 is what ES256 means; Apple publishes EC keys on this curve.
    const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    privateKey = pair.privateKey;
    publicJwk = {
      ...pair.publicKey.export({ format: 'jwk' }),
      kid: 'apple-test-kid',
      use: 'sig',
      alg: 'ES256',
    };
  });

  beforeEach(() => {
    env = loadEnv({
      ...process.env,
      APPLE_LOGIN_ENABLED: 'true',
      APPLE_CLIENT_IDS: CLIENT_ID,
      APPLE_JWKS_URL: JWKS_URL,
    } as NodeJS.ProcessEnv);

    fetchMock = vi.fn(async () => jwksResponse([publicJwk]));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jwksResponse(keys: unknown[]): Response {
    return new Response(JSON.stringify({ keys }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' },
    });
  }

  function adapter(overrides: Partial<Env> = {}): AppleIdentityAdapter {
    return new AppleIdentityAdapter({ ...env, ...overrides } as Env, new JwtService({}));
  }

  function sign(payload: Record<string, unknown>, options: Record<string, unknown> = {}): string {
    return new JwtService({}).sign(payload, {
      privateKey,
      algorithm: 'ES256',
      keyid: 'apple-test-kid',
      issuer: ISSUER,
      audience: CLIENT_ID,
      expiresIn: '10m',
      ...options,
    });
  }

  it('verifies a correctly signed token', async () => {
    const profile = await adapter().verify(
      sign({ sub: '000123.abc.0001', email: 'user@privaterelay.appleid.com', email_verified: 'true' }),
    );

    expect(profile).toEqual({
      provider: 'apple',
      subject: '000123.abc.0001',
      email: 'user@privaterelay.appleid.com',
      emailVerified: true,
      // Apple never puts a name in the ID token — it arrives once in the
      // authorisation response and never again.
      name: null,
      pictureUrl: null,
    });
  });

  it('treats Apple’s string "true" as verified', async () => {
    // Apple sends `email_verified` as a STRING. A `=== true` check would mark
    // every real Apple email unverified and drop the address.
    const profile = await adapter().verify(
      sign({ sub: 'sub-1', email: 'a@b.test', email_verified: 'true' }),
    );

    expect(profile.emailVerified).toBe(true);
    expect(profile.email).toBe('a@b.test');
  });

  it('drops the address when Apple says it is unverified', async () => {
    const profile = await adapter().verify(
      sign({ sub: 'sub-1', email: 'a@b.test', email_verified: 'false' }),
    );

    expect(profile.emailVerified).toBe(false);
    // An unverified address is a claim, not a fact — the account is keyed on
    // `sub`, so carrying it would only invite something later to trust it.
    expect(profile.email).toBeNull();
  });

  it('REFUSES a token signed with HS256 using the service secret', async () => {
    // The algorithm-confusion attack. Without `algorithms: ['ES256']`,
    // jsonwebtoken verifies this against the public key treated as an HMAC
    // secret, and social sign-in becomes "log in as anyone".
    const forged = new JwtService({}).sign(
      { sub: 'attacker' },
      {
        secret: env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        keyid: 'apple-test-kid',
        issuer: ISSUER,
        audience: CLIENT_ID,
        expiresIn: '10m',
      },
    );

    await expect(adapter().verify(forged)).rejects.toMatchObject({ status: 401 });
  });

  it('refuses a token minted for another app', async () => {
    // Without the audience pin, ANY Apple ID token from ANY app in the world
    // would authenticate here as that user.
    await expect(
      adapter().verify(sign({ sub: 'sub-1' }, { audience: 'com.someone.else' })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('refuses a token from another issuer', async () => {
    await expect(
      adapter().verify(sign({ sub: 'sub-1' }, { issuer: 'https://evil.test' })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('refuses an expired token', async () => {
    await expect(
      adapter().verify(sign({ sub: 'sub-1' }, { expiresIn: '-1m' })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('refuses a token signed by an unpublished key', async () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const forged = new JwtService({}).sign(
      { sub: 'sub-1' },
      {
        privateKey: other.privateKey,
        algorithm: 'ES256',
        keyid: 'apple-test-kid',
        issuer: ISSUER,
        audience: CLIENT_ID,
        expiresIn: '10m',
      },
    );

    await expect(adapter().verify(forged)).rejects.toMatchObject({ status: 401 });
  });

  it('refuses a token whose kid is not in the JWKS', async () => {
    await expect(
      adapter().verify(sign({ sub: 'sub-1' }, { keyid: 'unknown-kid' })),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('refuses a token carrying no subject', async () => {
    await expect(adapter().verify(sign({ email: 'a@b.test' }))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('refuses a malformed token', async () => {
    await expect(adapter().verify('not-a-jwt')).rejects.toMatchObject({ status: 401 });
  });

  it('reports a JWKS outage as 503, not 401', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));

    // A provider outage is not the caller's fault: the client should retry,
    // not be told their identity is invalid and sent to re-authenticate.
    await expect(adapter().verify(sign({ sub: 'sub-1' }))).rejects.toMatchObject({ status: 503 });
  });

  it('is disabled with the flag off', () => {
    expect(adapter({ APPLE_LOGIN_ENABLED: false } as Partial<Env>).enabled).toBe(false);
  });

  it('is disabled with no client ids, even with the flag on', async () => {
    // The flag alone is not enough: without an audience to pin, the verifier
    // would accept any Apple token from any app.
    const noAudience = adapter({ APPLE_CLIENT_IDS: [] } as unknown as Partial<Env>);

    expect(noAudience.enabled).toBe(false);
    await expect(noAudience.verify(sign({ sub: 'sub-1' }))).rejects.toMatchObject({ status: 403 });
  });
});
