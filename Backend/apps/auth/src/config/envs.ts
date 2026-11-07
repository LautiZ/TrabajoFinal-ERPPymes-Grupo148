import * as Joi from 'joi';
import { loadAppEnv, validateEnvs } from '@app/contracts';

loadAppEnv('auth');

interface EnvVars {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
}

const schema = Joi.object<EnvVars>({
  // 0.0.0.0 so other containers can reach it (Nest defaults to localhost)
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
