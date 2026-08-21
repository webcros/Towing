import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
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
  private readonly notificationSends: Counter<'channel' | 'vendor' | 'outcome'>;
  private readonly deadLettered: Counter<'job'>;
  private readonly breakerOpen: Gauge<'vendor'>;
  private readonly externalCalls: Counter<'vendor' | 'outcome'>;
  private readonly externalCallSeconds: Histogram<'vendor'>;
  private readonly locationPings: Counter<'outcome'>;
  private readonly driversOnline: Gauge<string>;

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

    this.notificationSends = new Counter({
      name: 'notification_sends_total',
      help: 'Outbound notification attempts by channel, vendor and outcome',
      labelNames: ['channel', 'vendor', 'outcome'],
      registers: [this.registry],
    });

    this.deadLettered = new Counter({
      name: 'notification_dead_lettered_total',
      help: 'Notification jobs that exhausted every attempt (§12.3 DLQ alarm)',
      labelNames: ['job'],
      registers: [this.registry],
    });

    this.breakerOpen = new Gauge({
      name: 'external_call_breaker_open',
      help: 'ExternalCallPolicy circuit breaker state per vendor (1 = open)',
      labelNames: ['vendor'],
      registers: [this.registry],
    });

    this.externalCalls = new Counter({
      name: 'external_calls_total',
      help: 'Outbound third-party calls by vendor and outcome (§19.3)',
      labelNames: ['vendor', 'outcome'],
      registers: [this.registry],
    });

    // Phase 14. The counter above says a vendor answered; only this says how
    // long it took. §7.6 caps `POST /pricing/estimate` at 2 s end to end and
    // the Distance Matrix call is the only unbounded thing inside it, so
    // "is Maps about to blow the estimate guarantee" is not answerable without
    // a latency distribution. Buckets are tuned around the 1.5 s routing
    // timeout rather than prom-client's web defaults.
    this.locationPings = new Counter({
      name: 'driver_location_pings_total',
      help: 'Driver location pings by pipeline outcome (§11.3)',
      labelNames: ['outcome'],
      registers: [this.registry],
    });

    this.driversOnline = new Gauge({
      name: 'drivers_online',
      help: 'Drivers in the §6.1 candidate store with a fresh ping, as last observed',
      registers: [this.registry],
    });

    this.externalCallSeconds = new Histogram({
      name: 'external_call_duration_seconds',
      help: 'Outbound third-party call latency by vendor (§19.3)',
      labelNames: ['vendor'],
      buckets: [0.05, 0.1, 0.25, 0.5, 1, 1.5, 2, 3, 5, 10],
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

  /** One outbound notification attempt reached a terminal state (§12.3). */
  observeNotificationSend(channel: string, vendor: string, outcome: 'sent' | 'failed'): void {
    if (!this.enabled) return;
    this.notificationSends.labels(channel, vendor, outcome).inc();
  }

  /**
   * A notification job exhausted its attempts and landed in the DLQ.
   *
   * Counted from `QueuePort.onDeadLetter` — i.e. from BullMQ's own
   * `worker.on('failed')` where `attempts >= max` is already known — and NOT
   * from `notification_deliveries.attempts`. That column increments on every
   * invocation, so an operator retrying a dead-lettered job would increment
   * this a second time for one message and the §12.3 depth alarm would be
   * measuring something other than what it claims.
   */
  observeDeadLetter(job: string): void {
    if (!this.enabled) return;
    this.deadLettered.labels(job).inc();
  }

  /** An `ExternalCallPolicy` breaker changed state. 1 = open, 0 = closed. */
  observeBreaker(vendor: string, open: boolean): void {
    if (!this.enabled) return;
    this.breakerOpen.labels(vendor).set(open ? 1 : 0);
  }

  /** One vendor call completed, whatever the outcome (§19.3 per-vendor metrics). */
  observeExternalCall(vendor: string, outcome: 'ok' | 'error' | 'timeout' | 'breaker_open'): void {
    if (!this.enabled) return;
    this.externalCalls.labels(vendor, outcome).inc();
  }

  /**
   * How long one vendor call took. Recorded for failures and timeouts too — a
   * vendor that is slow before it breaks is the signal worth having, and
   * dropping the failures would make the distribution look healthiest exactly
   * when the breaker is about to open.
   */
  observeExternalCallDuration(vendor: string, seconds: number): void {
    if (!this.enabled) return;
    this.externalCallSeconds.labels(vendor).observe(seconds);
  }

  /**
   * One driver location ping resolved (Phase 16).
   *
   * `discarded` IS THE INTERESTING SERIES, not `accepted`. A handful per
   * reconnect is normal and healthy — it is the on-device buffer replaying. A
   * sustained ratio means either a client whose `seq` is not monotonic across a
   * session or genuine packet reordering at scale, and the two are only
   * distinguishable if the number has been recorded from the start.
   */
  observeLocationPing(outcome: 'accepted' | 'discarded' | 'rejected' | 'low_accuracy'): void {
    if (!this.enabled) return;
    this.locationPings.labels(outcome).inc();
  }

  /**
   * Supply, as this task last observed it. A GAUGE SET FROM A COUNT, not an
   * incrementing counter: N Fargate tasks each handle a slice of the ping
   * stream, so increments would be per-task fictions. The candidate query
   * publishes the whole-cluster number it just read out of Redis.
   */
  observeDriversOnline(count: number): void {
    if (!this.enabled) return;
    this.driversOnline.set(count);
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
