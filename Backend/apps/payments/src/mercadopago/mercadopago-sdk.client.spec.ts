import { RpcException } from '@nestjs/microservices';
import { MPConnectionError, MercadoPagoConfig } from 'mercadopago';
import { MercadoPagoSdkClient } from './mercadopago-sdk.client';

const mockOrderCreate = jest.fn();
const mockOrderGet = jest.fn();

jest.mock('mercadopago', () => {
  const actual =
    jest.requireActual<typeof import('mercadopago')>('mercadopago');
  return {
    ...actual,
    MercadoPagoConfig: jest.fn(),
    Order: jest.fn(() => ({ create: mockOrderCreate, get: mockOrderGet })),
  };
});

const input = {
  externalReference: 'sale-1',
  idempotencyKey: 'payment-1',
  items: [
    { id: 'p-1', title: 'Yerba', quantity: 2, unitPrice: 1500.5 },
    { id: 'p-2', title: 'Queso', quantity: 1, unitPrice: 0.1 },
  ],
  backUrls: {
    success: 'https://front.test/payments/success',
    failure: 'https://front.test/payments/failure',
    pending: 'https://front.test/payments/pending',
  },
  autoReturn: true,
};

const rpcStatus = (error: unknown) =>
  ((error as RpcException).getError() as { status: number }).status;

describe('MercadoPagoSdkClient', () => {
  let client: MercadoPagoSdkClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new MercadoPagoSdkClient({
      accessToken: 'APP_USR-token',
      timeoutMs: 5000,
    });
  });

  it('configures the SDK with the access token and a timeout', () => {
    expect(MercadoPagoConfig).toHaveBeenCalledWith({
      accessToken: 'APP_USR-token',
      options: { timeout: 5000 },
    });
  });

  describe('createCheckout', () => {
    beforeEach(() => {
      mockOrderCreate.mockResolvedValue({
        id: 'ORD01',
        checkout_url: 'https://mp.test/checkout/v1/redirect?order_id=ORD01',
      });
    });

    it('creates a Checkout Pro order with amounts as decimal strings', async () => {
      await client.createCheckout(input);

      expect(mockOrderCreate).toHaveBeenCalledWith({
        body: {
          type: 'online',
          processing_mode: 'manual',
          external_reference: 'sale-1',
          // 2 x 1500.50 + 1 x 0.10, summed in cents to avoid float drift
          total_amount: '3001.10',
          items: [
            {
              external_code: 'p-1',
              title: 'Yerba',
              quantity: 2,
              unit_price: '1500.50',
            },
            {
              external_code: 'p-2',
              title: 'Queso',
              quantity: 1,
              unit_price: '0.10',
            },
          ],
          config: {
            online: {
              success_url: input.backUrls.success,
              failure_url: input.backUrls.failure,
              pending_url: input.backUrls.pending,
              auto_return: 'approved',
            },
          },
        },
        requestOptions: { idempotencyKey: 'payment-1' },
      });
    });

    it('omits auto return when it is disabled', async () => {
      await client.createCheckout({ ...input, autoReturn: false });

      const { body } = mockOrderCreate.mock.calls[0][0];
      expect(body.config.online).not.toHaveProperty('auto_return');
    });

    it('returns the order id and the checkout url', async () => {
      await expect(client.createCheckout(input)).resolves.toEqual({
        orderId: 'ORD01',
        checkoutUrl: 'https://mp.test/checkout/v1/redirect?order_id=ORD01',
      });
    });

    it('fails with 502 when the provider answers without a checkout url', async () => {
      mockOrderCreate.mockResolvedValue({ id: 'ORD01' });

      const error = await client.createCheckout(input).catch((e: unknown) => e);

      expect(rpcStatus(error)).toBe(502);
    });

    it('translates SDK errors to RPC errors', async () => {
      mockOrderCreate.mockRejectedValue(
        new MPConnectionError(new Error('ETIMEDOUT')),
      );

      const error = await client.createCheckout(input).catch((e: unknown) => e);

      expect(rpcStatus(error)).toBe(503);
    });
  });

  describe('getOrder', () => {
    it('returns the provider order in our own shape', async () => {
      mockOrderGet.mockResolvedValue({
        id: 'ORD01',
        status: 'processed',
        status_detail: 'accredited',
        external_reference: 'sale-1',
        total_amount: '3001.10',
        total_paid_amount: '3001.10',
      });

      await expect(client.getOrder('ORD01')).resolves.toEqual({
        id: 'ORD01',
        status: 'processed',
        statusDetail: 'accredited',
        externalReference: 'sale-1',
        totalAmount: 3001.1,
        paidAmount: 3001.1,
      });
      expect(mockOrderGet).toHaveBeenCalledWith({ id: 'ORD01' });
    });

    it('fills missing optional fields with neutral values', async () => {
      mockOrderGet.mockResolvedValue({ id: 'ORD01', status: 'created' });

      await expect(client.getOrder('ORD01')).resolves.toEqual({
        id: 'ORD01',
        status: 'created',
        statusDetail: null,
        externalReference: null,
        totalAmount: 0,
        paidAmount: 0,
      });
    });
  });
});
