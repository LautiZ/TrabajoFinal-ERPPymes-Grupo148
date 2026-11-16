import * as Joi from 'joi';
import { loadAppEnv, validateEnvs } from '@app/contracts';

loadAppEnv('gateway');

interface EnvVars {
  PORT: number;
  CORS_ORIGINS: string[];
  AUTH_MS_HOST: string;
  AUTH_MS_PORT: number;
  ERP_MS_HOST: string;
  ERP_MS_PORT: number;
  PAYMENTS_MS_HOST: string;
  PAYMENTS_MS_PORT: number;
}

const schema = Joi.object<EnvVars>({
  PORT: Joi.number().required(),
  CORS_ORIGINS: Joi.string()
    .required()
    .custom((value: string) => value.split(',').map((o) => o.trim())),
  AUTH_MS_HOST: Joi.string().required(),
  AUTH_MS_PORT: Joi.number().required(),
  ERP_MS_HOST: Joi.string().required(),
  ERP_MS_PORT: Joi.number().required(),
  PAYMENTS_MS_HOST: Joi.string().required(),
  PAYMENTS_MS_PORT: Joi.number().required(),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
