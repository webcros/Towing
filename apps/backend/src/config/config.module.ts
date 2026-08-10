import { Global, Module } from '@nestjs/common';
import { ENV, assertProductionSafety, loadEnv } from './env';
import { loadDotenv } from './load-dotenv';

/**
 * Global so every module can `@Inject(ENV)` without re-importing. Parsing
 * happens in the factory, so an invalid env fails during module init — the
 * process exits before it ever binds a port.
 */
@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: () => {
        loadDotenv();
        const env = loadEnv();
        assertProductionSafety(env);
        return env;
      },
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
