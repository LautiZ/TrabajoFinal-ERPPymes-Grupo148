import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as Joi from 'joi';
import * as path from 'path';
import { PrismaPg } from '@prisma/adapter-pg';
import { validateEnvs } from '@app/contracts';
import { PrismaClient as AuthClient } from '../apps/auth/src/generated/prisma/client';
import { PrismaClient as ErpClient } from '../apps/erp/src/generated/prisma/client';
import { seedAuth } from '../apps/auth/prisma/seed';
import { seedErp } from '../apps/erp/prisma/seed';

// Each .env is parsed into its own object instead of process.env: both files
// define DATABASE_URL, and dotenv never overrides a key that is already loaded,
// so the ERP seed would silently write into the auth database.
function readEnv(app: string): NodeJS.ProcessEnv {
  return dotenv.parse(
    fs.readFileSync(path.resolve(process.cwd(), `apps/${app}/.env`)),
  );
}

interface AuthSeedEnv {
  DATABASE_URL: string;
  OWNER_EMAIL: string;
  OWNER_PASSWORD: string;
  OWNER_NAME: string;
  OWNER_SURNAME?: string;
}

// No fallback credentials: a missing variable stops the seed
const authSchema = Joi.object<AuthSeedEnv>({
  DATABASE_URL: Joi.string().required(),
  // tlds disabled so local domains like owner@pyme.test are accepted
  OWNER_EMAIL: Joi.string()
    .email({ tlds: { allow: false } })
    .lowercase()
    .required(),
  OWNER_PASSWORD: Joi.string().min(12).max(128).required(),
  OWNER_NAME: Joi.string().required(),
  OWNER_SURNAME: Joi.string().optional(),
});

const erpSchema = Joi.object<{ DATABASE_URL: string }>({
  DATABASE_URL: Joi.string().required(),
});

async function main(): Promise<void> {
  const authEnv = validateEnvs(authSchema, readEnv('auth'));
  const erpEnv = validateEnvs(erpSchema, readEnv('erp'));

  const auth = new AuthClient({
    adapter: new PrismaPg({ connectionString: authEnv.DATABASE_URL }),
  });
  const erp = new ErpClient({
    adapter: new PrismaPg({ connectionString: erpEnv.DATABASE_URL }),
  });

  try {
    const ownerId = await seedAuth(auth, {
      email: authEnv.OWNER_EMAIL,
      password: authEnv.OWNER_PASSWORD,
      name: authEnv.OWNER_NAME,
      surname: authEnv.OWNER_SURNAME,
    });
    await seedErp(erp, ownerId);
  } finally {
    await Promise.all([auth.$disconnect(), erp.$disconnect()]);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
