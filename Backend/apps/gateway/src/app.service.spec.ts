import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError, NEVER } from 'rxjs';
import { AUTH_SERVICE, ERP_SERVICE, PAYMENTS_SERVICE } from '@app/contracts';
import { AppService } from './app.service';

describe('AppService', () => {
  let service: AppService;
  const authClient = { send: jest.fn() };
  const erpClient = { send: jest.fn() };
  const paymentsClient = { send: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: AUTH_SERVICE, useValue: authClient },
        { provide: ERP_SERVICE, useValue: erpClient },
        { provide: PAYMENTS_SERVICE, useValue: paymentsClient },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  it('should report every service as up when all of them respond', async () => {
    authClient.send.mockReturnValue(of(1));
    erpClient.send.mockReturnValue(of(2));
    paymentsClient.send.mockReturnValue(of(3));

    await expect(service.checkServices()).resolves.toEqual({
      auth: 'up',
      erp: 'up',
      payments: 'up',
    });
  });

  it('should report a service as down when its call fails', async () => {
    authClient.send.mockReturnValue(of(1));
    erpClient.send.mockReturnValue(throwError(() => new Error('ECONNREFUSED')));
    paymentsClient.send.mockReturnValue(of(3));

    await expect(service.checkServices()).resolves.toEqual({
      auth: 'up',
      erp: 'down',
      payments: 'up',
    });
  });

  it('should report a service as down when it does not answer in time', async () => {
    jest.useFakeTimers();
    authClient.send.mockReturnValue(of(1));
    erpClient.send.mockReturnValue(of(2));
    paymentsClient.send.mockReturnValue(NEVER);

    const result = service.checkServices();
    await jest.advanceTimersByTimeAsync(5000);

    await expect(result).resolves.toEqual({
      auth: 'up',
      erp: 'up',
      payments: 'down',
    });
    jest.useRealTimers();
  });
});
