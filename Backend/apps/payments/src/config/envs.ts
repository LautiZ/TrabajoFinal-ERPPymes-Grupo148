import * as Joi from 'joi';
import { loadAppEnv, validateEnvs } from '@app/contracts';

loadAppEnv('payments');

interface EnvVars {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  // Private Mercado Pago credential (use a test user's token in development)
  MP_ACCESS_TOKEN: string;
  MP_TIMEOUT_MS: number;
}

const schema = Joi.object<EnvVars>({
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
  MP_ACCESS_TOKEN: Joi.string().required(),
  MP_TIMEOUT_MS: Joi.number().integer().min(1000).default(5000),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
