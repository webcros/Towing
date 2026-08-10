import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { routePattern } from '../http/route-pattern';
import { currentRequestContext } from '../logging/request-context';
import { MetricsService } from './metrics.service';

/**
 * Times every HTTP request and attributes it to a route PATTERN.
 *
 * Registered as an `APP_INTERCEPTOR` provider rather than through
 * `app.useGlobalInterceptors()` in `main.ts`, deliberately: `src/test/app.ts`
 * has two hand-rolled application factories that replicate `main.ts` by hand,
 * and anything added there has to be mirrored in both or the tests stop
 * exercising what production runs. A provider is picked up by all three for
 * free.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.metrics.enabled || context.getType() !== 'http') return next.handle();

    const startedAt = process.hrtime.bigint();
    const route = routePattern(context);
    const request = context.switchToHttp().getRequest<{ method?: string }>();
    const response = context.switchToHttp().getResponse<Response>();

    const record = () => {
      const store = currentRequestContext();

      this.metrics.observeRequest({
        method: request.method ?? 'UNKNOWN',
        route,
        status: response.statusCode,
        durationSeconds: Number(process.hrtime.bigint() - startedAt) / 1e9,
        // Database time is carried on the async context by the query-timing
        // wrapper, so "which endpoint is database-bound?" is answerable per
        // route without a second, unlabelled global histogram.
        dbMs: store?.dbMs ?? 0,
        dbCalls: store?.dbCalls ?? 0,
      });
    };

    // Both arms: a request that 500s is exactly the one worth measuring, and
    // recording only successes would quietly flatter every latency percentile.
    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
