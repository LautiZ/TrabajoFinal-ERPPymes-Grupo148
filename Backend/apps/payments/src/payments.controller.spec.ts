import { PATTERN_METADATA } from '@nestjs/microservices/constants';
import { Test, TestingModule } from '@nestjs/testing';
import { PAYMENTS_PATTERNS } from '@app/contracts';
import { PaymentNotificationsService } from './payments/payment-notifications.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let paymentsController: PaymentsController;
  const paymentsService = {
    countPayments: jest.fn(),
    create: jest.fn(),
    getBySale: jest.fn(),
  };
  const notifications = { handle: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
        { provide: PaymentNotificationsService, useValue: notifications },
      ],
    }).compile();

    paymentsController = app.get<PaymentsController>(PaymentsController);
  });

  describe('countPayments', () => {
    it('should return the count of payments', async () => {
      paymentsService.countPayments.mockResolvedValue(5);
      expect(await paymentsController.countPayments()).toBe(5);
    });
  });

  describe('create', () => {
    it('delegates to the service with the sale id', async () => {
      paymentsService.create.mockResolvedValue({ id: 'pay-1' });

      expect(await paymentsController.create({ saleId: 'sale-1' })).toEqual({
        id: 'pay-1',
      });
      expect(paymentsService.create).toHaveBeenCalledWith({ saleId: 'sale-1' });
    });
  });

  describe('getBySale', () => {
    it('delegates to the service with the sale message', async () => {
      paymentsService.getBySale.mockResolvedValue({ id: 'pay-1' });

      expect(await paymentsController.getBySale({ saleId: 'sale-1' })).toEqual({
        id: 'pay-1',
      });
      expect(paymentsService.getBySale).toHaveBeenCalledWith({
        saleId: 'sale-1',
      });
    });
  });

  describe('handleNotification', () => {
    const notification = {
      type: 'order',
      dataId: 'ORD01',
      signedDataId: 'ORD01',
      xSignature: 'ts=1,v1=abc',
      xRequestId: 'req-1',
    };

    it('hands the whole notification to the notifications service', async () => {
      notifications.handle.mockResolvedValue(undefined);

      await expect(
        paymentsController.handleNotification(notification),
      ).resolves.toBeUndefined();
      expect(notifications.handle).toHaveBeenCalledWith(notification);
    });

    it('propagates the rejection so the gateway can answer the error', async () => {
      const failure = new Error('invalid signature');
      notifications.handle.mockRejectedValue(failure);

      await expect(
        paymentsController.handleNotification(notification),
      ).rejects.toBe(failure);
    });
  });

  // The gateway reaches the handlers only through these patterns
  describe('message patterns', () => {
    const patternOf = (method: keyof PaymentsController) =>
      Reflect.getMetadata(
        PATTERN_METADATA,
        // eslint-disable-next-line @typescript-eslint/unbound-method -- metadata lookup only
        PaymentsController.prototype[method],
      ) as unknown[];

    it.each([
      ['countPayments', PAYMENTS_PATTERNS.COUNT_PAYMENTS],
      ['create', PAYMENTS_PATTERNS.CREATE_PAYMENT],
      ['getBySale', PAYMENTS_PATTERNS.GET_SALE_PAYMENT],
      ['handleNotification', PAYMENTS_PATTERNS.HANDLE_NOTIFICATION],
    ] as const)('binds %s to %s', (method, pattern) => {
      expect(patternOf(method)).toEqual([pattern]);
    });
  });
});
