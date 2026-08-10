/**
 * The suite disables metrics globally (`src/test/setup.ts`) so no other spec
 * depends on the registry plumbing being right. This file is the one that does,
 * so it turns them back on for itself — before `loadEnv()` runs.
 */
process.env.METRICS_ENABLED = 'true';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authHeaderFor, createTestApp } from '../../test/app';
import { seedFleet, setupTestDatabase, truncateAll, type TestDatabase } from '../../test/db';
import { closeTestRedis } from '../../test/redis';
import { MetricsService } from './metrics.service';

describe('GET /v1/metrics', () => {
  let app: INestApplication;
  let db: TestDatabase;
  let auth: string;

  beforeAll(async () => {
    db = await setupTestDatabase();
    await truncateAll();
    app = await createTestApp();

    const fleet = await seedFleet(db, 'Metrics Fleet');
    auth = await authHeaderFor(app, { userId: fleet.ownerId, fleetId: fleet.fleetId });
  });

  afterAll(async () => {
    await app.close();
    await closeTestRedis();
  });

  it('serves the Prometheus text format', async () => {
    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);

    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# TYPE http_request_duration_seconds histogram');
  });

  it('includes default metrics, so event-loop lag is available next to latency', async () => {
    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);

    // The best leading indicator for the p95 SLO, and the reason
    // collectDefaultMetrics is on at all.
    expect(res.text).toContain('nodejs_eventloop_lag_seconds');
  });

  it('labels latency by route PATTERN, never by the concrete URL', async () => {
    await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', auth)
      .expect(200);

    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);

    expect(res.text).toContain('route="/fleet/trucks"');
    // A cursor or an id in the label would mint a new time series per request
    // and the registry would outgrow the data it describes.
    expect(res.text).not.toContain('route="/fleet/trucks?');
  });

  it('has the 0.2 and 0.5 buckets the SLOs are stated in', async () => {
    await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', auth)
      .expect(200);

    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);

    expect(res.text).toMatch(/http_request_duration_seconds_bucket\{le="0\.2"/);
    expect(res.text).toMatch(/http_request_duration_seconds_bucket\{le="0\.5"/);
  });

  it('records database time and statement count per route', async () => {
    await request(app.getHttpServer())
      .get('/v1/fleet/trucks')
      .set('Authorization', auth)
      .expect(200);

    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);

    expect(res.text).toContain('http_request_db_seconds_bucket');
    // An N+1 shows up here as a jump between buckets long before it shows up as
    // a latency regression.
    expect(res.text).toContain('http_request_db_queries_bucket');
  });

  it('is never itself throttled or access-logged into the noise', async () => {
    // A scraper is unauthenticated, so per-tenant keying resolves every scrape
    // to one shared ip: bucket — a monitoring endpoint that rate-limits its own
    // monitor is worse than no endpoint.
    for (let i = 0; i < 40; i += 1) {
      await request(app.getHttpServer()).get('/v1/metrics').expect(200);
    }
  });

  it('gives each app instance its own registry', async () => {
    // prom-client's DEFAULT registry is a module singleton: registering on it
    // would throw "already registered" the moment a second app booted in the
    // same process, which multi-instance.e2e.spec.ts and two others do.
    const second = await createTestApp();

    try {
      expect(second.get(MetricsService).registry).not.toBe(app.get(MetricsService).registry);
      await request(second.getHttpServer()).get('/v1/metrics').expect(200);
    } finally {
      await second.close();
    }
  });
});

describe('GET /v1/metrics with a token configured', () => {
  it('refuses a scrape without the bearer token', async () => {
    process.env.METRICS_TOKEN = 'scrape-me-please';

    const app = await createTestApp();
    try {
      await request(app.getHttpServer()).get('/v1/metrics').expect(401);
      await request(app.getHttpServer())
        .get('/v1/metrics')
        .set('Authorization', 'Bearer scrape-me-please')
        .expect(200);
    } finally {
      delete process.env.METRICS_TOKEN;
      await app.close();
    }
  });
});
