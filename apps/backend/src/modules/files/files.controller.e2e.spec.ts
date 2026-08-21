import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ENV, type Env } from '../../config/env';
import { STORAGE, type StoragePort } from '../../common/storage/storage.port';
import { signFileUrl } from '../../common/storage/file-signing';
import { createTestApp } from '../../test/app';

/**
 * `GET/PUT /v1/files/:key` (Phase 11, §3.1) — the seam that lets a browser or
 * driver app read/write a document with no Authorization header, backed
 * entirely by an HMAC over `method:key:exp`.
 */
describe('files controller (/v1/files)', () => {
  let app: INestApplication;
  let storage: StoragePort;
  let env: Env;

  beforeAll(async () => {
    app = await createTestApp();
    storage = app.get(STORAGE);
    env = app.get(ENV);
  });

  afterAll(async () => {
    await app.close();
  });

  function pathAndQuery(url: string): string {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  }

  it('round-trips bytes through a presigned PUT then a presigned GET', async () => {
    const key = `driver-documents/e2e-test/${Date.now()}.png`;
    const body = Buffer.from('hello from the files controller e2e spec');

    const put = await storage.presignPut(key, 60);
    await request(app.getHttpServer())
      .put(pathAndQuery(put.url))
      .set('Content-Type', 'application/octet-stream')
      .send(body)
      .expect(204);

    const get = await storage.presignGet(key, 60);
    const response = await request(app.getHttpServer()).get(pathAndQuery(get.url)).expect(200);

    expect(Buffer.from(response.body as ArrayBuffer).equals(body)).toBe(true);
    expect(response.headers['content-type']).toMatch(/^image\/png/);
  });

  it('rejects a PUT outside the driver-documents/ prefix even with a valid signature', async () => {
    const key = 'not-allowed/escape.png';
    const put = await storage.presignPut(key, 60);

    await request(app.getHttpServer())
      .put(pathAndQuery(put.url))
      .send(Buffer.from('nope'))
      .expect(403);
  });

  it('rejects an expired signature', async () => {
    const key = 'driver-documents/e2e-test/expired.png';
    const { sig, exp } = signFileUrl(env.FILE_SIGNING_SECRET, 'GET', key, -60);

    await request(app.getHttpServer())
      .get(`/v1/files/${key}?exp=${exp}&sig=${sig}`)
      .expect(403);
  });

  it('rejects a tampered signature', async () => {
    const key = 'driver-documents/e2e-test/tampered.png';
    const { sig, exp } = signFileUrl(env.FILE_SIGNING_SECRET, 'GET', key, 60);
    const tampered = sig.slice(0, -4) + (sig.slice(-4) === 'aaaa' ? 'bbbb' : 'aaaa');

    await request(app.getHttpServer())
      .get(`/v1/files/${key}?exp=${exp}&sig=${tampered}`)
      .expect(403);
  });

  it('rejects a signature minted for the other HTTP method', async () => {
    const key = 'driver-documents/e2e-test/wrong-method.png';
    const { sig, exp } = signFileUrl(env.FILE_SIGNING_SECRET, 'PUT', key, 60);

    await request(app.getHttpServer())
      .get(`/v1/files/${key}?exp=${exp}&sig=${sig}`)
      .expect(403);
  });

  it('rejects a traversal key even when its signature is genuinely valid', async () => {
    const key = '../../etc/passwd';
    const { sig, exp } = signFileUrl(env.FILE_SIGNING_SECRET, 'GET', key, 60);

    // The `..` segments MUST be sent percent-encoded. Superagent builds its
    // request path with `new URL()`, whose WHATWG parser collapses a raw
    // `/v1/files/../../etc/passwd` down to `/etc/passwd` before it ever leaves
    // the client — that never reaches this controller, so it 404s as an
    // unmatched Nest route and the assertion below would pass with
    // `resolveUploadsPath` deleted entirely. Encoded, the path survives intact
    // and `extractKey`'s `decodeURIComponent` restores the exact key the
    // signature was minted for, so verification passes and the traversal guard
    // is the only thing left to catch it — which is the point of the test.
    const encoded = key.split('/').map(encodeURIComponent).join('%2F');

    const res = await request(app.getHttpServer())
      .get(`/v1/files/${encoded}?exp=${exp}&sig=${sig}`)
      .expect(404);

    // Not a 403: the signature checks out (it was minted for this exact key),
    // which is exactly the case the traversal guard has to catch on its own.
    // Asserting the message distinguishes the controller's own 404 from Nest's
    // route-not-found 404 — the two are indistinguishable by status alone.
    expect(res.body.error.message).toBe('File not found');
  });

  it('404s a key that resolves inside the uploads root but does not exist', async () => {
    const get = await storage.presignGet('driver-documents/e2e-test/never-written.png', 60);
    await request(app.getHttpServer()).get(pathAndQuery(get.url)).expect(404);
  });
});
