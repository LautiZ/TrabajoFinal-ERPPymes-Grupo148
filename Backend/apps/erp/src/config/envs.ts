import * as Joi from 'joi';
import {
  DEFAULT_SALE_PAYMENT_WINDOW_MINUTES,
  loadAppEnv,
  validateEnvs,
} from '@app/contracts';

loadAppEnv('erp');

interface EnvVars {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  // Must match Payments: unpaid sales are cancelled 2 windows after creation
  SALE_PAYMENT_WINDOW_MINUTES: number;
}

const schema = Joi.object<EnvVars>({
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
  SALE_PAYMENT_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_SALE_PAYMENT_WINDOW_MINUTES),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
