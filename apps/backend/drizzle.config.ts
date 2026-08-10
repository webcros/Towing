import { existsSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

// drizzle-kit runs from apps/backend, so the local .env is right here.
if (existsSync('.env')) process.loadEnvFile('.env');

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set — copy apps/backend/.env.example to .env');
}

export default defineConfig({
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  // PostGIS owns these; without the filter drizzle-kit tries to drop them.
  tablesFilter: ['!spatial_ref_sys', '!geography_columns', '!geometry_columns'],
  verbose: true,
  strict: true,
});
