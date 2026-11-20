// Unit tests must not depend on each developer's apps/*/.env files: they are gitignored,
// so they do not exist in CI or in a fresh clone. Every config/envs.ts validates at import
// time, so placeholders are set before any module loads. `??=` keeps anything the shell
// already defines, and dotenv never overrides a variable that is already set.
// No literal secrets on purpose: secret scanners flag them even when they are fake.
const placeholders: Record<string, string> = {
  PORT: '0',
  DATABASE_URL: 'postgresql://localhost:5432/unit_tests',
  JWT_SECRET: 'x'.repeat(32),
  MP_ACCESS_TOKEN: 'unit-test',
  CORS_ORIGINS: 'http://localhost',
  AUTH_MS_HOST: 'localhost',
  AUTH_MS_PORT: '3001',
  ERP_MS_HOST: 'localhost',
  ERP_MS_PORT: '3002',
  PAYMENTS_MS_HOST: 'localhost',
  PAYMENTS_MS_PORT: '3003',
};

for (const [key, value] of Object.entries(placeholders)) {
  process.env[key] ??= value;
}
