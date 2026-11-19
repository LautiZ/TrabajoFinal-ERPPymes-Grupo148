import { SaleExpirationJob } from './sale-expiration.job';
import { SalesService } from './sales.service';

describe('SaleExpirationJob', () => {
  const salesService = { cancelExpired: jest.fn() };
  const job = new SaleExpirationJob(salesService as unknown as SalesService, {
    paymentWindowMinutes: 30,
    intervalMs: 60_000,
  });

  beforeEach(() => jest.clearAllMocks());

  // 2 windows of 30 min plus a 30 min margin for late notifications
  it('cancels sales older than two payment windows plus the margin', async () => {
    salesService.cancelExpired.mockResolvedValue(3);

    expect(await job.run()).toBe(3);
    expect(salesService.cancelExpired).toHaveBeenCalledWith(90);
  });

  it('does not start a run while the previous one is still going', async () => {
    let finish!: (value: number) => void;
    salesService.cancelExpired.mockReturnValueOnce(
      new Promise<number>((resolve) => (finish = resolve)),
    );

    const first = job.run();
    expect(await job.run()).toBe(0);
    finish(1);

    expect(await first).toBe(1);
    expect(salesService.cancelExpired).toHaveBeenCalledTimes(1);
  });

  it('survives a failed run', async () => {
    salesService.cancelExpired.mockRejectedValueOnce(new Error('db down'));

    expect(await job.run()).toBe(0);
    salesService.cancelExpired.mockResolvedValueOnce(0);
    expect(await job.run()).toBe(0);
  });

  it('waits for the run in progress when the module is destroyed', async () => {
    let finish!: (value: number) => void;
    salesService.cancelExpired.mockReturnValueOnce(
      new Promise<number>((resolve) => (finish = resolve)),
    );
    const clear = jest.spyOn(global, 'clearInterval');
    job.onModuleInit();
    void job.run();

    let destroyed = false;
    const destroying = job.onModuleDestroy().then(() => (destroyed = true));
    await Promise.resolve();
    expect(destroyed).toBe(false);

    finish(0);
    await destroying;
    expect(destroyed).toBe(true);
    expect(clear).toHaveBeenCalled();
  });
});
