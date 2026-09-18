import * as Joi from 'joi';
import { loadAppEnv, validateEnvs } from '@app/contracts';

loadAppEnv('gateway');

interface EnvVars {
  PORT: number;
}

const schema = Joi.object<EnvVars>({
  PORT: Joi.number().default(3000),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
