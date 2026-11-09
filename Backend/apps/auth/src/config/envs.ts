import * as Joi from 'joi';
import { loadAppEnv, validateEnvs } from '@app/contracts';

loadAppEnv('auth');

interface EnvVars {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  JWT_EXPIRES_IN: number;
  JWT_SECRET: string;
}

const schema = Joi.object<EnvVars>({
  // 0.0.0.0 so other containers can reach it (Nest defaults to localhost)
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
  // Access token lifetime in seconds; sessions.expires_at must match the token exp
  JWT_EXPIRES_IN: Joi.number().integer().positive().default(1800),
  // HMAC key used to sign access tokens; long and random, never committed
  JWT_SECRET: Joi.string().min(32).required(),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
