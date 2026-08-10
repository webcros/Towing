import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Loads `apps/backend/.env` into process.env using Node's built-in loader.
 *
 * Standalone entrypoints (drizzle-kit, seed, simulator, tests) need this before
 * `loadEnv()`; Nest's bootstrap calls it too. Real environment variables always
 * win — `loadEnvFile` does not overwrite what is already set — so a CI or
 * container-provided value is never clobbered by a stray local file.
 */
export function loadDotenv(): void {
  // src/config → app root under tsx; dist/config → app root after `nest build`.
  const envPath = resolve(__dirname, '../../.env');

  if (!existsSync(envPath)) return;

  process.loadEnvFile(envPath);
}
