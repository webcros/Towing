import { Module } from '@nestjs/common';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Exists so `ThrottlerModule.forRootAsync` has something to inject.
 *
 * `RedisThrottlerStorage` cannot simply be a provider of `AppModule`: the
 * storage has to be resolvable *while* the throttler's own options factory
 * runs, which is before `AppModule`'s providers exist. A tiny module that
 * `forRootAsync` imports is the standard way out, and it keeps the storage off
 * the global injector where nothing else should be reaching for it anyway.
 *
 * `RedisModule` is `@Global()`, so `REDIS` resolves here without an import.
 */
@Module({
  providers: [RedisThrottlerStorage],
  exports: [RedisThrottlerStorage],
})
export class ThrottlingModule {}
