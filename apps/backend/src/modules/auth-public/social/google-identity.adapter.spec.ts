import { createPublicKey, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadEnv, type Env } from '../../../config/env';
import { GoogleIdentityAdapter } from './google-identity.adapter';

const CLIENT_ID = '1234.apps.googleusercontent.com';
const JWKS_URL = 'https://jwks.test/certs';

/**
 * Google ID-token verification against a stubbed JWKS.
 *
 * The keypair is generated in-spec and its public half served through a faked
 * `fetch`, so this exercises the real signature path end to end without a
 * network call or a checked-in key.
 *
 * The assertion that matters most is the algorithm-confusion one: without an
 * explicit `algorithms: ['RS256']`, an attacker can sign their own payload with
 * HS256 using this service's own `JWT_ACCESS_SECRET` — which they can often
 * guess is in play — and jsonwebtoken will happily verify it against the "public
 * key" treated as an HMAC secret. That turns social sign-in into "log in as
 * anyone".
 */
describe('GoogleIdentityAdapter', () => {
  let env: Env;
  let privateKey: KeyObject;
  let publicJwk: Record<string, unknown>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(() => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    privateKey = pair.privateKey;
    publicJwk = { ...pair.publicKey.export({ format: 'jwk' }), kid: 'test-kid', use: 'sig', alg: 'RS256' };
  });

  beforeEach(() => {
    env = loadEnv({
      ...process.env,
      GOOGLE_OAUTH_CLIENT_IDS: CLIENT_ID,
      GOOGLE_JWKS_URL: JWKS_URL,
    });

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

  function adapter(overrides: Partial<Env> = {}): GoogleIdentityAdapter {
    return new GoogleIdentityAdapter({ ...env, ...overrides } as Env, new JwtService({}));
  }

  function sign(claims: Record<string, unknown>, kid = 'test-kid'): string {
    return new JwtService({}).sign(
      {
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        sub: 'google-subject-1',
        email: 'rider@example.com',
        email_verified: true,
        name: 'Test Rider',
        exp: Math.floor(Date.now() / 1000) + 600,
        ...claims,
      },
      { privateKey, algorithm: 'RS256', keyid: kid },
    );
  }

  it('accepts a well-formed token and returns the provider subject', async () => {
    const profile = await adapter().verify(sign({}));

    expect(profile).toMatchObject({
      provider: 'google',
      subject: 'google-subject-1',
      email: 'rider@example.com',
      emailVerified: true,
      name: 'Test Rider',
    });
  });

  it('REJECTS an HS256 token signed with our own access secret (algorithm confusion)', async () => {
    // The attack: take the PEM the server would verify against — which is
    // public — and use it as an HMAC key. Without `algorithms: ['RS256']`,
    // jsonwebtoken verifies it and the attacker is whoever they claimed to be.
    const pem = createPublicKey({ key: publicJwk as never, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();

    const forged = new JwtService({}).sign(
      {
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        sub: 'attacker',
        email_verified: true,
        exp: Math.floor(Date.now() / 1000) + 600,
      },
      { secret: pem, algorithm: 'HS256', keyid: 'test-kid' },
    );

    await expect(adapter().verify(forged)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects a token minted for a different Google client (wrong aud)', async () => {
    // Without the audience pin, ANY valid Google ID token from ANY app on earth
    // would authenticate here as that user.
    await expect(adapter().verify(sign({ aud: 'someone-elses-app' }))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('rejects a token from the wrong issuer', async () => {
    await expect(adapter().verify(sign({ iss: 'https://evil.example' }))).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('rejects an expired token', async () => {
    await expect(
      adapter().verify(sign({ exp: Math.floor(Date.now() / 1000) - 60 })),
    ).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('rejects a token signed by a key Google does not publish', async () => {
    const rogue = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const forged = new JwtService({}).sign(
      { iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'x', exp: Math.floor(Date.now() / 1000) + 600 },
      { privateKey: rogue.privateKey, algorithm: 'RS256', keyid: 'test-kid' },
    );

    await expect(adapter().verify(forged)).rejects.toMatchObject({ code: 'unauthorized' });
  });

  it('carries an unverified email through as null rather than trusting it', async () => {
    // The account is keyed on `sub`, so an unverified address costs nothing as
    // long as nothing downstream treats it as an identity.
    const profile = await adapter().verify(sign({ email_verified: false }));

    expect(profile.emailVerified).toBe(false);
    expect(profile.email).toBeNull();
  });

  it('caches the key set across verifications', async () => {
    const google = adapter();
    await google.verify(sign({}));
    await google.verify(sign({}));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches exactly once when a token carries an unknown kid (key rotation)', async () => {
    const google = adapter();
    await google.verify(sign({}));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Google rotated: a token arrives signed by a key the cache has never seen.
    await expect(google.verify(sign({}, 'rotated-kid'))).rejects.toMatchObject({
      code: 'unauthorized',
    });
    // One refetch, not a retry loop — a garbage `kid` must not become a way to
    // hammer Google's endpoint.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports itself disabled when no client ids are configured', async () => {
    const unconfigured = adapter({ GOOGLE_OAUTH_CLIENT_IDS: [] as unknown as Env['GOOGLE_OAUTH_CLIENT_IDS'] });

    expect(unconfigured.enabled).toBe(false);
    // 403, not a silent accept: an unpinned audience would be worse than no
    // Google sign-in at all.
    await expect(unconfigured.verify(sign({}))).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('reports a JWKS outage as 503, not as a bad token', async () => {
    // The client should retry, not re-authenticate — this is not their fault.
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }));

    await expect(adapter().verify(sign({}))).rejects.toMatchObject({ status: 503 });
  });
});
