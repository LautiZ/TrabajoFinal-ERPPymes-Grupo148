import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsService } from './analytics.service';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return (err as RpcException).getError() as Record<string, unknown>;
  }
  throw new Error('expected the promise to reject');
};

// November 2026 in Argentina time, as the frontend sends it
const november = {
  from: '2026-11-01T00:00:00.000-03:00',
  to: '2026-11-30T23:59:59.999-03:00',
};

const totals = (overrides: Record<string, number> = {}) => ({
  revenue: 0,
  salesCount: 0,
  unitsSold: 0,
  cancelledCount: 0,
  ...overrides,
});

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  const repository = {
    kpis: jest.fn(),
    salesOverTime: jest.fn(),
    topProducts: jest.fn(),
    inventoryValue: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        { provide: AnalyticsRepository, useValue: repository },
      ],
    }).compile();
    service = module.get(AnalyticsService);
  });

  describe('summary', () => {
    it('returns the metrics of the range and of the previous one', async () => {
      repository.kpis
        .mockResolvedValueOnce(
          totals({ revenue: 3000, salesCount: 4, unitsSold: 9 }),
        )
        .mockResolvedValueOnce(totals({ revenue: 1000, salesCount: 2 }));

      await expect(service.summary(november)).resolves.toEqual({
        current: {
          revenue: 3000,
          salesCount: 4,
          averageTicket: 750,
          unitsSold: 9,
          cancelledCount: 0,
        },
        previous: {
          revenue: 1000,
          salesCount: 2,
          averageTicket: 500,
          unitsSold: 0,
          cancelledCount: 0,
        },
      });
    });

    // Half-open ranges: the previous period ends exactly where the current one
    // starts, so no sale falls between them (30 days: October 2 to 31)
    it('compares against the period of equal length right before', async () => {
      repository.kpis.mockResolvedValue(totals());

      await service.summary(november);

      const [current, previous] = repository.kpis.mock.calls.map(
        ([range]: [{ from: Date; end: Date }][]) => range,
      ) as unknown as { from: Date; end: Date }[];
      expect(current.from.toISOString()).toBe('2026-11-01T03:00:00.000Z');
      expect(current.end.toISOString()).toBe('2026-12-01T03:00:00.000Z');
      expect(previous.from.toISOString()).toBe('2026-10-02T03:00:00.000Z');
      expect(previous.end).toEqual(current.from);
    });

    // Regression: these pass @IsISO8601 but new Date() gives Invalid Date
    it.each(['2026-W44-1T00:00:00Z', '2026-305T00:00:00Z'])(
      'answers 400 for %s instead of failing in the database',
      async (from) => {
        expect(
          await errorOf(service.summary({ from, to: november.to })),
        ).toMatchObject({ status: 400 });
        expect(repository.kpis).not.toHaveBeenCalled();
      },
    );

    it('accepts a single instant (from equal to to)', async () => {
      repository.kpis.mockResolvedValue(totals());

      await service.summary({ from: november.from, to: november.from });

      expect(repository.kpis).toHaveBeenCalledTimes(2);
    });

    it('reports an average ticket of 0 when there are no sales', async () => {
      repository.kpis.mockResolvedValue(totals({ cancelledCount: 3 }));

      const { current } = await service.summary(november);

      expect(current.averageTicket).toBe(0);
      expect(current.cancelledCount).toBe(3);
    });

    it('rounds the average ticket to cents', async () => {
      repository.kpis.mockResolvedValue(
        totals({ revenue: 100, salesCount: 3 }),
      );

      expect((await service.summary(november)).current.averageTicket).toBe(
        33.33,
      );
    });

    it('answers 400 when from is after to', async () => {
      expect(
        await errorOf(
          service.summary({ from: november.to, to: november.from }),
        ),
      ).toMatchObject({ status: 400 });
      expect(repository.kpis).not.toHaveBeenCalled();
    });

    it('answers 400 for a range longer than 5 years', async () => {
      expect(
        await errorOf(
          service.summary({
            from: '2020-01-01T00:00:00.000-03:00',
            to: november.to,
          }),
        ),
      ).toMatchObject({ status: 400 });
    });
  });

  describe('salesOverTime', () => {
    it('returns the series of the chosen grouping', async () => {
      const series = [{ period: '2026-11-01', revenue: 10, salesCount: 1 }];
      repository.salesOverTime.mockResolvedValue(series);

      await expect(
        service.salesOverTime({ ...november, groupBy: 'week' }),
      ).resolves.toEqual({ groupBy: 'week', series });
      expect(repository.salesOverTime).toHaveBeenCalledWith(
        expect.objectContaining({ from: expect.any(Date) }),
        'week',
      );
    });

    it('answers 400 when grouping by day would return too many points', async () => {
      expect(
        await errorOf(
          service.salesOverTime({
            from: '2023-01-01T00:00:00.000-03:00',
            to: november.to,
            groupBy: 'day',
          }),
        ),
      ).toMatchObject({ status: 400 });
      expect(repository.salesOverTime).not.toHaveBeenCalled();
    });

    // Boundary: exactly 400 whole days by day is 400 points, the maximum
    it('accepts exactly 400 days grouped by day, rejects 401', async () => {
      repository.salesOverTime.mockResolvedValue([]);
      const from = '2025-10-26T00:00:00.000-03:00';

      await expect(
        service.salesOverTime({
          from,
          to: '2026-11-29T23:59:59.999-03:00',
          groupBy: 'day',
        }),
      ).resolves.toBeDefined();
      expect(
        await errorOf(
          service.salesOverTime({
            from,
            to: '2026-11-30T23:59:59.999-03:00',
            groupBy: 'day',
          }),
        ),
      ).toMatchObject({ status: 400 });
    });

    it('accepts the same long range grouped by month', async () => {
      repository.salesOverTime.mockResolvedValue([]);

      await expect(
        service.salesOverTime({
          from: '2023-01-01T00:00:00.000-03:00',
          to: november.to,
          groupBy: 'month',
        }),
      ).resolves.toEqual({ groupBy: 'month', series: [] });
    });
  });

  describe('topProducts', () => {
    it('returns the ranking with the requested limit', async () => {
      const items = [
        {
          productId: 'p-1',
          name: 'Yerba',
          sku: 'YER',
          unitsSold: 5,
          revenue: 50,
        },
      ];
      repository.topProducts.mockResolvedValue(items);

      await expect(
        service.topProducts({ ...november, limit: 5 }),
      ).resolves.toEqual({ items });
      expect(repository.topProducts).toHaveBeenCalledWith(
        expect.objectContaining({ end: expect.any(Date) }),
        5,
      );
    });
  });

  describe('inventoryValue', () => {
    it('returns the valuation from the repository', async () => {
      const value = {
        totalValuation: 1000,
        totalUnits: 10,
        lowStockCount: 1,
        outOfStockCount: 0,
        activeProducts: 3,
      };
      repository.inventoryValue.mockResolvedValue(value);

      await expect(service.inventoryValue()).resolves.toBe(value);
    });
  });
});
