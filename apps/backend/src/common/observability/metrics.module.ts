import { Global, Module } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';
import { ERROR_REPORTER } from './error-reporter.port';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { NoopErrorReporter } from './noop-error-reporter';
import { SentryErrorReporter } from './sentry-error-reporter';

/**
 * `@Global()` so the throttler guard can count its own rejections without
 * `AppModule` growing another import edge, and so a future producer anywhere in
 * the graph can inject the service directly.
 *
 * The `HttpMetricsInterceptor` is registered in `AppModule` as an
 * `APP_INTERCEPTOR`, not here: interceptor providers only take effect in the
 * root module.
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    NoopErrorReporter,
    SentryErrorReporter,
    {
      provide: ERROR_REPORTER,
      inject: [ENV, NoopErrorReporter, SentryErrorReporter],
      /**
       * Two independent reasons to bind the noop, so no single mistake can make
       * a test suite talk to a third party:
       *  - `NODE_ENV === 'test'` wins REGARDLESS of the DSN, so a developer with
       *    SENTRY_DSN exported in their shell still cannot send from a test run;
       *  - and without a DSN there is nowhere to send anyway.
       * `observability.spec.ts` asserts the first of those, so a future
       * refactor of this factory fails loudly.
       */
      useFactory: (env: Env, noop: NoopErrorReporter, sentry: SentryErrorReporter) =>
        env.NODE_ENV === 'test' || !env.SENTRY_DSN ? noop : sentry,
    },
  ],
  exports: [MetricsService, ERROR_REPORTER],
})
export class MetricsModule {}
