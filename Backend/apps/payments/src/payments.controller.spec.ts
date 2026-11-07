import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments/payments.repository';

describe('PaymentsController', () => {
  let paymentsController: PaymentsController;
  let paymentsRepository: PaymentsRepository;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        PaymentsService,
        { provide: PaymentsRepository, useValue: { count: jest.fn() } },
      ],
    }).compile();

    paymentsController = app.get<PaymentsController>(PaymentsController);
    paymentsRepository = app.get<PaymentsRepository>(PaymentsRepository);
  });

  describe('countPayments', () => {
    it('should return the count of payments', async () => {
      jest.spyOn(paymentsRepository, 'count').mockResolvedValue(5);
      expect(await paymentsController.countPayments()).toBe(5);
    });
  });
});
