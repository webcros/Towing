import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { ENV, type Env } from '../../config/env';

/**
 * Prometheus metrics for the API.
 *
 * WHAT SCRAPES THIS TODAY: nothing. `Aws/06` is explicit that latency
 * observability is ALB metrics plus CloudWatch Logs, and there is no AMP, no
 * ADOT collector and no Grafana anywhere in the deployment plan. The honest
 * justification for shipping it now is that it is what makes a k6 run
 * *interpretable* — a p95 that moved is a mystery without event-loop lag and
 * per-route database time next to it. Choosing the production scrape path is a
 * cost and vendor decision, and it is in `ToBeDoneEhsan.md`. Until then this is
 * a local instrument, not monitoring, and it should not be mistaken for it.
 *
 * ⚠ EVERY METRIC IS REGISTERED ON THIS INSTANCE'S OWN `Registry`, never on
 * prom-client's default global one. The default registry is a module singleton,
 * so a second app booted in the same process — which
 * `multi-instance.e2e.spec.ts`, the throttle spec and the refresh-grace spec all
 * do — would throw "a metric with the name … has already been registered" on
 * the second boot.
 */
@Injectable()
export class MetricsService implements OnApplicationShutdown {
  readonly registry = new Registry();

  private readonly httpDuration: Histogram<'method' | 'route' | 'status'>;
  private readonly httpDbSeconds: Histogram<'route'>;
  private readonly httpDbQueries: Histogram<'route'>;
  private readonly throttled: Counter<'bucket'>;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.httpDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Request latency by route pattern',
      labelNames: ['method', 'route', 'status'],
      // 0.2 and 0.5 are present deliberately: they are the §19.1 p95 and p99
      // budgets, so both SLOs read straight off a bucket rather than out of an
      // interpolation between two neighbouring ones.
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpDbSeconds = new Histogram({
      name: 'http_request_db_seconds',
      help: 'Time spent in SQL per request, by route pattern',
      labelNames: ['route'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1],
      registers: [this.registry],
    });

    this.httpDbQueries = new Histogram({
      name: 'http_request_db_queries',
      help: 'Statements issued per request, by route pattern',
      labelNames: ['route'],
      // Chosen to make an N+1 obvious: a route that jumps from the 5 bucket to
      // the 50 one has grown a loop, and no latency percentile says that as
      // plainly.
      buckets: [1, 2, 5, 10, 20, 50, 100],
      registers: [this.registry],
    });

    this.throttled = new Counter({
      name: 'throttler_rejections_total',
      help: '429s issued, by bucket',
      labelNames: ['bucket'],
      registers: [this.registry],
    });

    if (env.METRICS_ENABLED) {
      // Event-loop lag above all: it is the single best leading indicator for
      // the p95 SLO, and it moves before latency does.
      collectDefaultMetrics({ register: this.registry });
    }
  }

  get enabled(): boolean {
    return this.env.METRICS_ENABLED;
  }

  observeRequest(params: {
    method: string;
    route: string;
    status: number;
    durationSeconds: number;
    dbMs: number;
    dbCalls: number;
  }): void {
    if (!this.enabled) return;

    this.httpDuration
      .labels(params.method, params.route, String(params.status))
      .observe(params.durationSeconds);
    this.httpDbSeconds.labels(params.route).observe(params.dbMs / 1000);
    this.httpDbQueries.labels(params.route).observe(params.dbCalls);
  }

  observeThrottled(bucket: string): void {
    if (!this.enabled) return;
    this.throttled.labels(bucket).inc();
  }

  async scrape(): Promise<{ body: string; contentType: string }> {
    return { body: await this.registry.metrics(), contentType: this.registry.contentType };
  }

  onApplicationShutdown(): void {
    // prom-client 15 collects the default metrics at scrape time rather than on
    // a timer, so there is nothing to stop — but clearing releases the
    // collectors this registry is holding.
    this.registry.clear();
  }
}
