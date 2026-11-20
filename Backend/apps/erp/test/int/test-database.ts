import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import * as path from 'path';

// Integration tests run against a real, isolated database: same Postgres as
// the compose stack, but its own database, so dev data is never touched.
export const TEST_DATABASE = 'erp_pymes_test';

const BACKEND_ROOT = path.resolve(__dirname, '../../../..');

// ERP_TEST_DATABASE_URL wins (e.g. CI). Otherwise the URL is built from the
// root .env that docker-compose uses, pointing at the published port.
export const testDatabaseUrl = (database = TEST_DATABASE): string => {
  if (process.env.ERP_TEST_DATABASE_URL && database === TEST_DATABASE) {
    return process.env.ERP_TEST_DATABASE_URL;
  }
  const env: Record<string, string | undefined> = dotenv.parse(
    readFileSync(path.resolve(BACKEND_ROOT, '../.env')),
  );
  const user = encodeURIComponent(env.POSTGRES_USER ?? 'postgres');
  const password = encodeURIComponent(env.POSTGRES_PASSWORD ?? '');
  const host = process.env.TEST_DB_HOST ?? 'localhost';
  const port = process.env.TEST_DB_PORT ?? '5432';
  return `postgresql://${user}:${password}@${host}:${port}/${database}?schema=erp`;
};

export { BACKEND_ROOT };
