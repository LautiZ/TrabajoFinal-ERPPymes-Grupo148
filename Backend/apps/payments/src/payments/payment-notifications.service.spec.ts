import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { SALE_CANCELLED } from '@app/contracts';
import { SalesClient } from '../erp/sales.client';
import { MercadoPagoClient } from '../mercadopago/mercadopago.client';
import { PaymentNotificationsService } from './payment-notifications.service';
import { PaymentsRepository } from './payments.repository';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return (err as RpcException).getError() as Record<string, unknown>;
  }
  throw new Error('expected the promise to reject');
};

const notification = {
  type: 'order',
  dataId: 'ORD01',
  signedDataId: 'ORD01',
  xSignature: 'ts=1,v1=abc',
  xRequestId: 'req-1',
};

const payment = (overrides: Record<string, unknown> = {}) => ({
  id: 'pay-1',
  saleId: 'sale-1',
  amount: 3001.1,
  paymentState: 'Pending',
  mpOrderId: 'ORD01',
  checkoutUrl: 'https://mp.test/checkout',
  createdAt: new Date('2026-11-18T12:00:00Z'),
  ...overrides,
});

const order = (overrides: Record<string, unknown> = {}) => ({
  id: 'ORD01',
  status: 'processed',
  statusDetail: 'accredited',
  externalReference: 'sale-1',
  totalAmount: 3001.1,
  paidAmount: 3001.1,
  paymentId: 'PAY01',
  ...overrides,
});

describe('PaymentNotificationsService', () => {
  let service: PaymentNotificationsService;
  const sales = { markPaid: jest.fn(), cancelSale: jest.fn() };
  const payments = {
    findByOrderId: jest.fn(),
    transition: jest.fn(),
    findOtherPaid: jest.fn(),
  };
  const mercadoPago = {
    isAuthenticNotification: jest.fn(),
    getOrder: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mercadoPago.isAuthenticNotification.mockReturnValue(true);
    mercadoPago.getOrder.mockResolvedValue(order());
    payments.findByOrderId.mockResolvedValue(payment());
    payments.transition.mockResolvedValue(true);
    payments.findOtherPaid.mockResolvedValue(null);
    sales.markPaid.mockResolvedValue({ id: 'sale-1', currentState: 'Paid' });

    const module = await Test.createTestingModule({
      providers: [
        PaymentNotificationsService,
        { provide: SalesClient, useValue: sales },
        { provide: PaymentsRepository, useValue: payments },
        { provide: MercadoPagoClient, useValue: mercadoPago },
      ],
    }).compile();
    service = module.get(PaymentNotificationsService);
  });

  it('checks the signature with the signed query id only', async () => {
    await service.handle({ ...notification, signedDataId: undefined });

    expect(mercadoPago.isAuthenticNotification).toHaveBeenCalledWith({
      dataId: undefined,
      xSignature: 'ts=1,v1=abc',
      xRequestId: 'req-1',
    });
  });

  it('marks the payment and the sale as paid when the order is processed', async () => {
    await service.handle(notification);

    expect(mercadoPago.getOrder).toHaveBeenCalledWith('ORD01');
    expect(sales.markPaid).toHaveBeenCalledWith('sale-1');
    expect(payments.transition).toHaveBeenCalledWith(
      'pay-1',
      ['Pending', 'Rejected'],
      'Paid',
      'PAY01',
    );
  });

  // If the ERP call fails, the payment must stay Pending so the retry of the
  // notification confirms the sale again
  it('confirms the sale before recording the payment', async () => {
    sales.markPaid.mockRejectedValue(
      new RpcException({ status: 503, message: 'ERP service unavailable' }),
    );

    expect(await errorOf(service.handle(notification))).toMatchObject({
      status: 503,
    });
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('rejects a notification with an invalid signature with 401', async () => {
    mercadoPago.isAuthenticNotification.mockReturnValue(false);

    expect(await errorOf(service.handle(notification))).toMatchObject({
      status: 401,
    });
    expect(mercadoPago.getOrder).not.toHaveBeenCalled();
  });

  it('ignores topics other than order', async () => {
    await service.handle({ ...notification, type: 'payment' });

    expect(mercadoPago.isAuthenticNotification).not.toHaveBeenCalled();
    expect(mercadoPago.getOrder).not.toHaveBeenCalled();
  });

  it('ignores a notification without data.id', async () => {
    await service.handle({ ...notification, dataId: undefined });

    expect(mercadoPago.getOrder).not.toHaveBeenCalled();
  });

  it('ignores an order that is not ours', async () => {
    payments.findByOrderId.mockResolvedValue(null);

    await service.handle(notification);

    expect(mercadoPago.getOrder).not.toHaveBeenCalled();
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('ignores an order whose external reference is another sale', async () => {
    mercadoPago.getOrder.mockResolvedValue(
      order({ externalReference: 'sale-2' }),
    );

    await service.handle(notification);

    expect(sales.markPaid).not.toHaveBeenCalled();
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('does not confirm the sale when less than the total was paid', async () => {
    mercadoPago.getOrder.mockResolvedValue(order({ paidAmount: 1500 }));

    await service.handle(notification);

    expect(sales.markPaid).not.toHaveBeenCalled();
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('trusts the processed status when the paid amount is missing', async () => {
    mercadoPago.getOrder.mockResolvedValue(order({ paidAmount: 0 }));

    await service.handle(notification);

    expect(sales.markPaid).toHaveBeenCalledWith('sale-1');
  });

  it('records the payment and does not retry when the ERP answers a 4xx', async () => {
    sales.markPaid.mockRejectedValue(
      new RpcException({ status: 404, message: 'Sale not found' }),
    );

    await service.handle(notification);

    expect(payments.transition).toHaveBeenCalled();
  });

  it('still records a second paid attempt of the same sale (double charge)', async () => {
    payments.findByOrderId.mockResolvedValue(
      payment({ paymentState: 'Rejected', checkoutUrl: null }),
    );
    payments.findOtherPaid.mockResolvedValue(payment({ id: 'pay-0' }));

    await service.handle(notification);

    expect(payments.findOtherPaid).toHaveBeenCalledWith('sale-1', 'pay-1');
    expect(payments.transition).toHaveBeenCalledWith(
      'pay-1',
      ['Pending', 'Rejected'],
      'Paid',
      'PAY01',
    );
  });

  it('does not confirm the sale when the paid amount differs (RN-13)', async () => {
    mercadoPago.getOrder.mockResolvedValue(order({ totalAmount: 10 }));

    await service.handle(notification);

    expect(sales.markPaid).not.toHaveBeenCalled();
    expect(payments.transition).not.toHaveBeenCalled();
  });

  // TES-75: a failed payment cancels the sale and returns its stock
  it.each(['failed', 'canceled', 'expired'])(
    'cancels the sale and records the payment as rejected when the order is %s',
    async (status) => {
      sales.cancelSale.mockResolvedValue({ currentState: 'Cancelled' });
      mercadoPago.getOrder.mockResolvedValue(
        order({ status, paymentId: 'PAY02' }),
      );

      await service.handle(notification);

      expect(sales.markPaid).not.toHaveBeenCalled();
      expect(sales.cancelSale).toHaveBeenCalledWith('sale-1');
      expect(payments.transition).toHaveBeenCalledWith(
        'pay-1',
        ['Pending'],
        'Rejected',
        'PAY02',
      );
    },
  );

  // Same order as Paid: if the ERP fails, the retry must cancel the sale again
  it('cancels the sale before recording the rejection', async () => {
    mercadoPago.getOrder.mockResolvedValue(order({ status: 'failed' }));
    sales.cancelSale.mockRejectedValue(
      new RpcException({ status: 503, message: 'ERP service unavailable' }),
    );

    expect(await errorOf(service.handle(notification))).toMatchObject({
      status: 503,
    });
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('still records the rejection when another attempt already paid the sale', async () => {
    mercadoPago.getOrder.mockResolvedValue(order({ status: 'failed' }));
    sales.cancelSale.mockResolvedValue({ currentState: 'Paid' });

    await service.handle(notification);

    expect(payments.transition).toHaveBeenCalledWith(
      'pay-1',
      ['Pending'],
      'Rejected',
      'PAY01',
    );
  });

  it('records the rejection and does not retry when the ERP answers a 4xx', async () => {
    mercadoPago.getOrder.mockResolvedValue(order({ status: 'failed' }));
    sales.cancelSale.mockRejectedValue(
      new RpcException({ status: 404, message: 'Sale not found' }),
    );

    await service.handle(notification);

    expect(payments.transition).toHaveBeenCalled();
  });

  it('does not cancel the sale again on a repeated rejection', async () => {
    payments.findByOrderId.mockResolvedValue(
      payment({ paymentState: 'Rejected' }),
    );
    mercadoPago.getOrder.mockResolvedValue(order({ status: 'failed' }));

    await service.handle(notification);

    expect(sales.cancelSale).not.toHaveBeenCalled();
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('records nothing while the order is still in progress', async () => {
    mercadoPago.getOrder.mockResolvedValue(
      order({ status: 'action_required' }),
    );

    await service.handle(notification);

    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('does nothing for a repeated notification of a paid payment', async () => {
    payments.findByOrderId.mockResolvedValue(payment({ paymentState: 'Paid' }));

    await service.handle(notification);

    expect(sales.markPaid).not.toHaveBeenCalled();
    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('never moves a paid payment back to rejected (late notification)', async () => {
    payments.findByOrderId.mockResolvedValue(payment({ paymentState: 'Paid' }));
    mercadoPago.getOrder.mockResolvedValue(order({ status: 'failed' }));

    await service.handle(notification);

    expect(payments.transition).not.toHaveBeenCalled();
  });

  it('records the payment even if the sale was cancelled meanwhile', async () => {
    sales.markPaid.mockRejectedValue(
      new RpcException({ status: 409, code: SALE_CANCELLED, message: 'x' }),
    );

    await service.handle(notification);

    // The money arrived: the payment says so, and the refund is TES-75's job
    expect(payments.transition).toHaveBeenCalledWith(
      'pay-1',
      ['Pending', 'Rejected'],
      'Paid',
      'PAY01',
    );
  });

  it('propagates Mercado Pago errors so the notification is retried', async () => {
    mercadoPago.getOrder.mockRejectedValue(
      new RpcException({
        status: 503,
        message: 'Payment provider unavailable',
      }),
    );

    expect(await errorOf(service.handle(notification))).toMatchObject({
      status: 503,
    });
  });
});
