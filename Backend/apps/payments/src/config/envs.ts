import * as Joi from 'joi';
import {
  DEFAULT_SALE_PAYMENT_WINDOW_MINUTES,
  loadAppEnv,
  validateEnvs,
} from '@app/contracts';

loadAppEnv('payments');

interface EnvVars {
  HOST: string;
  PORT: number;
  DATABASE_URL: string;
  // Private Mercado Pago credential: production credentials of a test seller
  MP_ACCESS_TOKEN: string;
  MP_TIMEOUT_MS: number;
  // Secret signature of the app's webhooks (Tus integraciones > Webhooks)
  MP_WEBHOOK_SECRET: string;
  // Payments reads sales from the ERP MS (amount and items, RN-13)
  ERP_MS_HOST: string;
  ERP_MS_PORT: number;
  // Where Mercado Pago sends the buyer back after the checkout
  FRONTEND_URL: string;
  // Must match the ERP: a sale can open a payment this long after it was
  // registered, and each Mercado Pago order expires this long after creation
  SALE_PAYMENT_WINDOW_MINUTES: number;
}

const schema = Joi.object<EnvVars>({
  HOST: Joi.string().default('0.0.0.0'),
  PORT: Joi.number().required(),
  DATABASE_URL: Joi.string().required(),
  MP_ACCESS_TOKEN: Joi.string().required(),
  // Capped: two tries of this must fit in the gateway timeout of the payment
  // route (PAYMENT_TCP_TIMEOUT_MS, 15 s) together with the ERP call
  MP_TIMEOUT_MS: Joi.number().integer().min(1000).max(5000).default(5000),
  // Optional so the stack boots without webhooks configured; while empty,
  // every notification is rejected with 401 and payments stay Pending
  MP_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  ERP_MS_HOST: Joi.string().default('localhost'),
  ERP_MS_PORT: Joi.number().default(3002),
  FRONTEND_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:4200')
    // Trailing slash would produce //payments/success
    .custom((value: string) => value.replace(/\/+$/, '')),
  SALE_PAYMENT_WINDOW_MINUTES: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_SALE_PAYMENT_WINDOW_MINUTES),
}).unknown(true);

export const envs = validateEnvs(schema, process.env);
