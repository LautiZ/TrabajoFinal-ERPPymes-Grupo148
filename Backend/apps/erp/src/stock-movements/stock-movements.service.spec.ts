import { Test } from '@nestjs/testing';
import { StockMovementsRepository } from './stock-movements.repository';
import type { StockMovementRow } from './stock-movements.repository';
import { StockMovementsService } from './stock-movements.service';

const yerba = { id: 'p-1', name: 'Yerba 1kg', sku: 'YER-1' };
const createdAt = new Date('2026-11-21T12:00:00Z');

const row = (overrides: Partial<StockMovementRow>): StockMovementRow => ({
  id: 'm-1',
  type: 'Income',
  quantity: 5,
  reason: null,
  saleNumber: null,
  product: yerba,
  createdAt,
  ...overrides,
});

describe('StockMovementsService', () => {
  let service: StockMovementsService;
  const repository = { list: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        StockMovementsService,
        { provide: StockMovementsRepository, useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(StockMovementsService);
  });

  it('returns a page of movements, newest first as the repository gives them', async () => {
    repository.list.mockResolvedValue([[row({})], 21]);

    const page = await service.list({ page: 2, limit: 10 });

    expect(repository.list).toHaveBeenCalledWith({ page: 2, limit: 10 });
    expect(page.meta).toEqual({ total: 21, page: 2, limit: 10, totalPages: 3 });
    expect(page.data).toEqual([
      {
        id: 'm-1',
        type: 'Income',
        direction: 'In',
        quantity: 5,
        reason: null,
        saleNumber: null,
        product: yerba,
        createdAt,
      },
    ]);
  });

  it('an Outcome is always an exit', async () => {
    repository.list.mockResolvedValue([
      [row({ type: 'Outcome', quantity: 2, saleNumber: 113 })],
      1,
    ]);

    const [movement] = (await service.list({ page: 1, limit: 10 })).data;
    expect(movement).toMatchObject({
      direction: 'Out',
      quantity: 2,
      saleNumber: 113,
    });
  });

  // Adjustments are stored signed (RN-03): the sign gives the direction and
  // the quantity is shown positive
  it.each([
    [3, 'In', 3],
    [-1.5, 'Out', 1.5],
  ] as const)(
    'an Adjustment of %s is %s %s',
    async (stored, direction, quantity) => {
      repository.list.mockResolvedValue([
        [row({ type: 'Adjustment', quantity: stored, reason: 'Recount' })],
        1,
      ]);

      const [movement] = (await service.list({ page: 1, limit: 10 })).data;
      expect(movement).toMatchObject({
        direction,
        quantity,
        reason: 'Recount',
      });
    },
  );
});
