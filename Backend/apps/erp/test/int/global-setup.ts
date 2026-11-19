import { execSync } from 'child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import { BACKEND_ROOT, TEST_DATABASE, testDatabaseUrl } from './test-database';

// Runs once before the integration suite: creates the test database if it
// does not exist and applies every ERP migration, like the compose migrate job.
export default async function globalSetup(): Promise<void> {
  const admin = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl('postgres') }),
  });
  try {
    const rows = await admin.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${TEST_DATABASE}) AS exists`;
    if (!rows[0]?.exists) {
      // Identifiers cannot be bound as parameters; the name is a constant
      await admin.$executeRawUnsafe(`CREATE DATABASE "${TEST_DATABASE}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execSync(
    // pnpm exec resolves the local prisma binary on Windows and Linux alike
    'pnpm exec prisma migrate deploy --config apps/erp/prisma.config.ts',
    {
      cwd: BACKEND_ROOT,
      // dotenv in prisma.config.ts does not override variables already set
      env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
      stdio: 'pipe',
    },
  );
}
