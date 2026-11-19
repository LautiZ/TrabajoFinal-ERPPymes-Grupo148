// Smoke test against the real Mercado Pago sandbox: creates a Checkout Pro order and reads it back.
// Usage from Backend/ (reads MP_ACCESS_TOKEN from apps/payments/.env):
//   create: pnpm mp:smoke
//   check:  pnpm mp:smoke <orderId>
import { randomUUID } from 'crypto';
import { RpcException } from '@nestjs/microservices';
import { loadAppEnv } from '@app/contracts';
import { MercadoPagoSdkClient } from '../apps/payments/src/mercadopago/mercadopago-sdk.client';

loadAppEnv('payments');

const accessToken = process.env.MP_ACCESS_TOKEN;
if (!accessToken) throw new Error('Set MP_ACCESS_TOKEN in apps/payments/.env');

const client = new MercadoPagoSdkClient({ accessToken, timeoutMs: 10000 });
const orderId = process.argv[2];

const run = async () => {
  if (orderId) {
    console.log(await client.getOrder(orderId));
    return;
  }
  const checkout = await client.createCheckout({
    externalReference: `smoke-${Date.now()}`,
    idempotencyKey: randomUUID(),
    items: [
      { code: 'YER-1KG', title: 'Yerba 1kg', quantity: 2, unitPrice: 1500.5 },
      { code: 'QUE-CRE', title: 'Queso', quantity: 1, unitPrice: 999.99 },
    ],
    backUrls: {
      success: 'https://example.com/success',
      failure: 'https://example.com/failure',
      pending: 'https://example.com/pending',
    },
    autoReturn: true,
  });
  console.log(checkout);
};

run().catch((error: unknown) => {
  console.error(error instanceof RpcException ? error.getError() : error);
  process.exitCode = 1;
});
