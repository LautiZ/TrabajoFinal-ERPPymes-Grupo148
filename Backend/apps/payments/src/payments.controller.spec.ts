import { Test, TestingModule } from '@nestjs/testing';
import { PaymentNotificationsService } from './payments/payment-notifications.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let paymentsController: PaymentsController;
  const paymentsService = { countPayments: jest.fn(), create: jest.fn() };
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
});
