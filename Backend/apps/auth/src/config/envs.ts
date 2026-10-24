import * as Joi from 'joi';
import { loadAppEnv, validateEnvs } from '@app/contracts';

loadAppEnv('auth');

interface EnvVars {
  PORT: number;
  DATABASE_URL: string;
}

const schema = Joi.object<EnvVars>({
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
