import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { GeoPoint } from '@towing/api-contracts';
import { ENV, type Env } from '../../config/env';
import { ExternalCallPolicy } from '../http/external-call.policy';
import type { RouteDistance, RoutingPort } from './routing.port';

/**
 * Google Distance Matrix, through §19.3's `ExternalCallPolicy`.
 *
 * NEVER EXECUTED AGAINST GOOGLE. No Maps key exists (SETUP-CHECKLIST item 7),
 * so this is written against the documented request/response shape and
 * exercised only by fakes — the same honest standing as Phase 13's four channel
 * adapters. `ROUTING_PROVIDER` defaults to `haversine` and production refuses to
 * boot on this adapter with no key.
 *
 * THE TIMEOUT IS THE INTERESTING PART. §19.3 says 2–5 s for a vendor call, but
 * this one is inside `POST /pricing/estimate`, which §7.6 caps at 2 s end to
 * end. `ROUTING_TIMEOUT_MS` defaults to 1.5 s so that a hung Google still leaves
 * room to fall back to Haversine — which is pure arithmetic — and answer inside
 * the guarantee. Two attempts, not three, for the same reason: 2 × 1.5 s already
 * spends the whole budget, and the breaker is what stops the bleeding after
 * that.
 */

/** A vendor answer that will be exactly as wrong next time. Not worth a retry. */
export class DistanceMatrixPermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DistanceMatrixPermanentError';
  }
}

interface DistanceMatrixResponse {
  status?: string;
  error_message?: string;
  rows?: Array<{
    elements?: Array<{
      status?: string;
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
}

/**
 * Top-level statuses that mean "the request itself is wrong". Retrying these
 * burns the §7.6 budget and delays the fallback that would have served the
 * customer a fare. `OVER_QUERY_LIMIT` and `UNKNOWN_ERROR` are deliberately
 * absent — those are blips and are worth the second attempt.
 */
const PERMANENT_STATUSES = new Set([
  'REQUEST_DENIED',
  'INVALID_REQUEST',
  'MAX_ELEMENTS_EXCEEDED',
  'MAX_DIMENSIONS_EXCEEDED',
]);

/** Per-element statuses that mean there is no route, however many times we ask. */
const PERMANENT_ELEMENT_STATUSES = new Set([
  'NOT_FOUND',
  'ZERO_RESULTS',
  'MAX_ROUTE_LENGTH_EXCEEDED',
]);

@Injectable()
export class GoogleDistanceMatrixAdapter implements RoutingPort, OnModuleInit {
  readonly vendor = 'google_distance_matrix';

  private readonly logger = new Logger(GoogleDistanceMatrixAdapter.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly policy: ExternalCallPolicy,
  ) {}

  onModuleInit(): void {
    // Guarded on the provider switch: both adapters are instantiated whichever
    // one the factory picks, so an unguarded check here would warn on every
    // boot of a Haversine deployment. `assertProductionSafety` already refuses
    // this combination in production; in dev it is a warning so a
    // half-configured .env is obvious now rather than at the first estimate.
    if (this.env.ROUTING_PROVIDER !== 'google_distance_matrix') return;
    if (!this.env.GOOGLE_MAPS_API_KEY) {
      this.logger.warn('ROUTING_PROVIDER=google_distance_matrix but GOOGLE_MAPS_API_KEY is unset');
    }
  }

  async roadDistance(from: GeoPoint, to: GeoPoint): Promise<RouteDistance> {
    return this.policy.run<RouteDistance>(
      {
        vendor: this.vendor,
        attempts: 2,
        backoffMs: 150,
        timeoutMs: this.env.ROUTING_TIMEOUT_MS,
        isRetryable: (error) => !(error instanceof DistanceMatrixPermanentError),
      },
      async (signal) => {
        const url = new URL(this.env.GOOGLE_DISTANCE_MATRIX_URL);
        url.searchParams.set('origins', `${from.lat},${from.lng}`);
        url.searchParams.set('destinations', `${to.lat},${to.lng}`);
        url.searchParams.set('mode', 'driving');
        url.searchParams.set('units', 'metric');
        url.searchParams.set('key', this.env.GOOGLE_MAPS_API_KEY ?? '');

        const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
        const text = await response.text();

        if (!response.ok) {
          // A 4xx is a bad request; a 5xx is Google having a moment.
          if (response.status < 500) {
            throw new DistanceMatrixPermanentError(`${response.status}: ${text.slice(0, 200)}`);
          }
          throw new Error(`Distance Matrix returned ${response.status}`);
        }

        const body = JSON.parse(text) as DistanceMatrixResponse;

        // Distance Matrix answers 200 OK with a failure in the body — a
        // response-level status check is not optional here.
        if (body.status && body.status !== 'OK') {
          const detail = `${body.status}${body.error_message ? `: ${body.error_message}` : ''}`;
          if (PERMANENT_STATUSES.has(body.status)) {
            throw new DistanceMatrixPermanentError(detail);
          }
          throw new Error(`Distance Matrix status ${detail}`);
        }

        const element = body.rows?.[0]?.elements?.[0];
        if (!element) throw new DistanceMatrixPermanentError('Distance Matrix returned no elements');

        if (element.status && element.status !== 'OK') {
          if (PERMANENT_ELEMENT_STATUSES.has(element.status)) {
            throw new DistanceMatrixPermanentError(`element ${element.status}`);
          }
          throw new Error(`Distance Matrix element status ${element.status}`);
        }

        const distanceMeters = element.distance?.value;
        if (typeof distanceMeters !== 'number' || !Number.isFinite(distanceMeters)) {
          throw new DistanceMatrixPermanentError('Distance Matrix returned no distance value');
        }

        return {
          distanceMeters: Math.round(distanceMeters),
          durationSeconds:
            typeof element.duration?.value === 'number'
              ? Math.round(element.duration.value)
              : null,
          source: 'google_distance_matrix',
        };
      },
    );
  }
}
