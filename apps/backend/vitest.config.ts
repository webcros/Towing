import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    // Vitest transforms with esbuild by default and esbuild cannot emit
    // `design:paramtypes`. Nest resolves every provider's constructor
    // dependencies from exactly that metadata, so without swc a guard or
    // service that compiles fine under `nest build` fails DI inside
    // `Test.createTestingModule(...).compile()`. unplugin-swc reads
    // apps/backend/tsconfig.json for `experimentalDecorators` /
    // `emitDecoratorMetadata`; `jsc` below only pins what must not drift.
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        // tsconfig says "ES2023", which swc's target enum does not accept.
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test/setup.ts'],
    // Every suite shares one Postgres database and truncates between tests, so
    // two files running at once would delete each other's fixtures mid-assert.
    // This is also what keeps concurrent migrate() calls from racing on DDL.
    fileParallelism: false,
    // Fresh module graph per file. The connection pool in src/test/db.ts is a
    // module singleton that each file closes in afterAll; without isolation the
    // second file in a reused worker would inherit a closed pool.
    isolate: true,
    testTimeout: 30_000,
    // A cold `docker compose --profile test up -d` still has to boot the PostGIS
    // image and apply the whole migration set before the first beforeAll returns.
    hookTimeout: 120_000,
    teardownTimeout: 20_000,
  },
});
