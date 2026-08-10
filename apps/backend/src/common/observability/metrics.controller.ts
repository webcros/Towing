import { Controller, Get, Headers, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiException } from '../errors/api-exception';
import { ENV, type Env } from '../../config/env';
import { SkipThrottling } from '../throttling/throttler.config';
import { MetricsService } from './metrics.service';

/**
 * `GET /v1/metrics` in the Prometheus text exposition format.
 *
 * Under the same `/v1` prefix as everything else rather than carved out at the
 * root: one prefix rule with no exceptions is worth more than a tidier URL, and
 * a scraper is configured with a path either way.
 *
 * `@SkipThrottling()` for the same reason as `HealthController` — a scraper is
 * unauthenticated, so per-tenant keying resolves every scrape to one shared
 * `ip:` bucket, and a monitoring endpoint that rate-limits its own monitor is
 * worse than useless. It is also excluded from the access log, or a 15-second
 * scrape interval would dominate the log volume.
 */
@Controller('metrics')
@SkipThrottling()
export class MetricsController {
  constructor(
    private readonly metrics: MetricsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get()
  async scrape(
    @Headers('authorization') authorization: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    // Disabled means genuinely absent, not empty: a scraper pointed at a task
    // with metrics off should fail loudly rather than record zeroes that look
    // like a healthy idle process.
    if (!this.metrics.enabled) throw ApiException.notFound('Metrics are not enabled');

    // Optional by design, matching `/v1/health`: local development must not
    // need a token. Whether this endpoint should be reachable from the internet
    // at all — it discloses route names, request volumes and error rates — is
    // an ALB listener-rule decision recorded in ToBeDoneEhsan.md.
    if (this.env.METRICS_TOKEN && authorization !== `Bearer ${this.env.METRICS_TOKEN}`) {
      throw ApiException.unauthorized('Metrics token is missing or invalid');
    }

    const { body, contentType } = await this.metrics.scrape();
    response.setHeader('Content-Type', contentType);
    response.send(body);
  }
}
