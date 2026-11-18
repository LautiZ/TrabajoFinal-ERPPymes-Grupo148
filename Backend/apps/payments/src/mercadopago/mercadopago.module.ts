import { Module } from '@nestjs/common';
import { envs } from '../config/envs';
import { MercadoPagoClient } from './mercadopago.client';
import {
  MERCADOPAGO_OPTIONS,
  MercadoPagoOptions,
  MercadoPagoSdkClient,
} from './mercadopago-sdk.client';

@Module({
  providers: [
    {
      provide: MERCADOPAGO_OPTIONS,
      useValue: {
        accessToken: envs.MP_ACCESS_TOKEN,
        timeoutMs: envs.MP_TIMEOUT_MS,
        webhookSecret: envs.MP_WEBHOOK_SECRET,
      } satisfies MercadoPagoOptions,
    },
    { provide: MercadoPagoClient, useClass: MercadoPagoSdkClient },
  ],
  exports: [MercadoPagoClient],
})
export class MercadoPagoModule {}
