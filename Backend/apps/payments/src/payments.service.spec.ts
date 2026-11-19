import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import type { SaleView } from '@app/contracts';
import { SalesClient } from './erp/sales.client';
import { MercadoPagoClient } from './mercadopago/mercadopago.client';
import { CHECKOUT_OPTIONS } from './payments/checkout-options';
import { PaymentsRepository } from './payments/payments.repository';
import { PaymentsService, STALE_RESERVATION_MS } from './payments.service';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return (err as RpcException).getError() as Record<string, unknown>;
  }
  throw new Error('expected the promise to reject');
};

const createdAt = new Date('2026-11-18T12:00:00Z');

const sale = {
  id: 'sale-1',
  saleNumber: 7,
  total: 3001,
  currentState: 'Ordered',
  items: [
    {
      productId: 'p-1',
      name: 'Yerba',
      sku: 'YER-1',
      quantity: 2,
      unitPrice: 1500.5,
      subtotal: 3001,
    },
  ],
} as SaleView;

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  saleId: 'sale-1',
  amount: 3001,
  paymentState: 'Pending',
  mpOrderId: null,
  checkoutUrl: null,
  createdAt,
  ...overrides,
});

const view = {
  id: 'pay-1',
  saleId: 'sale-1',
  amount: 3001,
  state: 'Pending',
  checkoutUrl: 'https://mp.test/checkout?order_id=ORD01',
  createdAt,
};

describe('PaymentsService', () => {
  let service: PaymentsService;
  const sales = { getSale: jest.fn() };
  const payments = {
    count: jest.fn(),
    findPendingBySale: jest.fn(),
    reservePending: jest.fn(),
    attachCheckout: jest.fn(),
    releaseIfUnattached: jest.fn(),
    findLatestBySale: jest.fn(),
  };
  const mercadoPago = { createCheckout: jest.fn(), getOrder: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Registered a minute ago: well inside the 30 min payment window
    sales.getSale.mockResolvedValue({
      ...sale,
      createdAt: new Date(Date.now() - 60_000),
    });
    payments.findPendingBySale.mockResolvedValue(null);
    payments.reservePending.mockResolvedValue(row());
    payments.releaseIfUnattached.mockResolvedValue(true);
    payments.attachCheckout.mockResolvedValue(
      row({ mpOrderId: 'ORD01', checkoutUrl: view.checkoutUrl }),
    );
    mercadoPago.createCheckout.mockResolvedValue({
      orderId: 'ORD01',
      checkoutUrl: view.checkoutUrl,
    });

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: SalesClient, useValue: sales },
        { provide: PaymentsRepository, useValue: payments },
        { provide: MercadoPagoClient, useValue: mercadoPago },
        {
          provide: CHECKOUT_OPTIONS,
          useValue: {
            frontendUrl: 'http://localhost:4200',
            paymentWindowMinutes: 30,
          },
        },
      ],
    }).compile();
    service = module.get(PaymentsService);
  });

  describe('create', () => {
    it('opens a Mercado Pago checkout for the sale total', async () => {
      await expect(service.create({ saleId: 'sale-1' })).resolves.toEqual(view);

      expect(payments.reservePending).toHaveBeenCalledWith('sale-1', 3001);
      expect(mercadoPago.createCheckout).toHaveBeenCalledWith({
        externalReference: 'sale-1',
        // The reserved row id: a retried request never creates a second order
        idempotencyKey: 'pay-1',
        items: [
          { code: 'YER-1', title: 'Yerba', quantity: 2, unitPrice: 1500.5 },
        ],
        backUrls: {
          success: 'http://localhost:4200/payments/success',
          failure: 'http://localhost:4200/payments/failure',
          pending: 'http://localhost:4200/payments/pending',
        },
        autoReturn: true,
        // The order expires with the payment window (TES-75)
        expirationMinutes: 30,
      });
      expect(payments.attachCheckout).toHaveBeenCalledWith('pay-1', {
        orderId: 'ORD01',
        checkoutUrl: view.checkoutUrl,
      });
    });

    it('rejects a sale that is not waiting for payment', async () => {
      sales.getSale.mockResolvedValue({ ...sale, currentState: 'Paid' });

      expect(await errorOf(service.create({ saleId: 'sale-1' }))).toEqual({
        status: 409,
        message: 'Sale is not awaiting payment (current state: Paid)',
        code: 'SALE_NOT_PAYABLE',
      });
      expect(payments.reservePending).not.toHaveBeenCalled();
    });

    it('rejects a new checkout once the sale is past its payment window', async () => {
      sales.getSale.mockResolvedValue({
        ...sale,
        createdAt: new Date(Date.now() - 31 * 60_000),
      });

      expect(await errorOf(service.create({ saleId: 'sale-1' }))).toMatchObject(
        { status: 409, code: 'SALE_PAYMENT_EXPIRED' },
      );
      expect(payments.reservePending).not.toHaveBeenCalled();
      expect(mercadoPago.createCheckout).not.toHaveBeenCalled();
    });

    // The open order is still payable until its own expiry
    it('still resumes an open checkout after the window', async () => {
      sales.getSale.mockResolvedValue({
        ...sale,
        createdAt: new Date(Date.now() - 31 * 60_000),
      });
      payments.findPendingBySale.mockResolvedValue(
        row({ mpOrderId: 'ORD01', checkoutUrl: view.checkoutUrl }),
      );

      await expect(service.create({ saleId: 'sale-1' })).resolves.toEqual(view);
    });

    it('reuses the open checkout instead of creating another order', async () => {
      payments.findPendingBySale.mockResolvedValue(
        row({ mpOrderId: 'ORD01', checkoutUrl: view.checkoutUrl }),
      );

      await expect(service.create({ saleId: 'sale-1' })).resolves.toEqual(view);
      expect(mercadoPago.createCheckout).not.toHaveBeenCalled();
      expect(payments.reservePending).not.toHaveBeenCalled();
    });

    it('returns the winner when a concurrent request reserved first', async () => {
      payments.reservePending.mockResolvedValue(null);
      payments.findPendingBySale
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          row({ mpOrderId: 'ORD01', checkoutUrl: view.checkoutUrl }),
        );

      await expect(service.create({ saleId: 'sale-1' })).resolves.toEqual(view);
      expect(mercadoPago.createCheckout).not.toHaveBeenCalled();
    });

    it('asks to retry while another request is still creating the checkout', async () => {
      payments.findPendingBySale.mockResolvedValue(
        row({ createdAt: new Date() }),
      );

      expect((await errorOf(service.create({ saleId: 'sale-1' }))).status).toBe(
        409,
      );
      expect(mercadoPago.createCheckout).not.toHaveBeenCalled();
    });

    it('releases the reservation when Mercado Pago fails', async () => {
      const failure = new RpcException({ status: 503, message: 'down' });
      mercadoPago.createCheckout.mockRejectedValue(failure);

      await expect(service.create({ saleId: 'sale-1' })).rejects.toBe(failure);
      expect(payments.releaseIfUnattached).toHaveBeenCalledWith('pay-1');
      expect(payments.attachCheckout).not.toHaveBeenCalled();
    });

    it('keeps the Mercado Pago error when releasing the reservation also fails', async () => {
      const failure = new RpcException({ status: 503, message: 'down' });
      mercadoPago.createCheckout.mockRejectedValue(failure);
      payments.releaseIfUnattached.mockRejectedValue(new Error('db down'));

      await expect(service.create({ saleId: 'sale-1' })).rejects.toBe(failure);
    });

    // The order already exists in Mercado Pago: the row is left for the stale
    // check below instead of being deleted right away
    it('does not release the reservation when storing the checkout fails', async () => {
      const dbError = new Error('db down');
      payments.attachCheckout.mockRejectedValue(dbError);

      await expect(service.create({ saleId: 'sale-1' })).rejects.toBe(dbError);
      expect(payments.releaseIfUnattached).not.toHaveBeenCalled();
    });

    it('replaces a reservation abandoned by a request that died', async () => {
      payments.findPendingBySale.mockResolvedValueOnce(
        row({
          id: 'pay-old',
          createdAt: new Date(Date.now() - STALE_RESERVATION_MS - 1000),
        }),
      );

      await expect(service.create({ saleId: 'sale-1' })).resolves.toEqual(view);
      expect(payments.releaseIfUnattached).toHaveBeenCalledWith('pay-old');
      expect(payments.reservePending).toHaveBeenCalledWith('sale-1', 3001);
    });

    it('propagates ERP errors without touching payments', async () => {
      const notFound = new RpcException({ status: 404, message: 'nope' });
      sales.getSale.mockRejectedValue(notFound);

      await expect(service.create({ saleId: 'sale-1' })).rejects.toBe(notFound);
      expect(payments.findPendingBySale).not.toHaveBeenCalled();
    });
  });

  describe('getBySale', () => {
    // The row keeps its checkout url (DB check), but a paid attempt hides it
    it('returns the latest payment attempt of the sale', async () => {
      payments.findLatestBySale.mockResolvedValue(
        row({
          paymentState: 'Paid',
          mpOrderId: 'ORD01',
          checkoutUrl: view.checkoutUrl,
        }),
      );

      await expect(service.getBySale({ saleId: 'sale-1' })).resolves.toEqual({
        ...view,
        state: 'Paid',
        checkoutUrl: null,
      });
      expect(payments.findLatestBySale).toHaveBeenCalledWith('sale-1');
    });

    it('answers 404 when the sale has no payment yet', async () => {
      payments.findLatestBySale.mockResolvedValue(null);

      expect(await errorOf(service.getBySale({ saleId: 'sale-1' }))).toEqual({
        status: 404,
        message: 'The sale has no payment',
      });
    });
  });
});
