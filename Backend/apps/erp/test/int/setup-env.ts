import { testDatabaseUrl } from './test-database';

// Before any ERP module loads: config/envs.ts reads DATABASE_URL at import
// time, and loadAppEnv (dotenv) never overrides a variable already set
process.env.DATABASE_URL = testDatabaseUrl();
process.env.PORT ??= '0';
