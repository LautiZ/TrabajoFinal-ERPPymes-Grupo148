import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import type { SaleView } from '@app/contracts';
import { Prisma } from '../generated/prisma/client';
import { InsufficientStockError, SaleTotalTooLargeError } from './sale-errors';
import { SalesRepository } from './sales.repository';
import { SalesService } from './sales.service';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return (err as RpcException).getError() as Record<string, unknown>;
  }
  throw new Error('expected the promise to reject');
};

const userId = 'user-1';
const yerba = { id: 'p-1', name: 'Yerba', unit: 'Unit' as const };
const queso = { id: 'p-2', name: 'Queso', unit: 'Kg' as const };

const sale = { id: 'sale-1', total: 100 } as SaleView;

const message = (items: { productId: string; quantity: number }[]) => ({
  userId,
  sale: { items },
});

describe('SalesService', () => {
  let service: SalesService;
  const sales = {
    findProducts: jest.fn(),
    createSale: jest.fn(),
    list: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    sales.findProducts.mockResolvedValue([yerba, queso]);

    const module = await Test.createTestingModule({
      providers: [SalesService, { provide: SalesRepository, useValue: sales }],
    }).compile();
    service = module.get(SalesService);
  });

  describe('create', () => {
    it('creates the sale for the session user', async () => {
      sales.createSale.mockResolvedValue(sale);
      const items = [
        { productId: 'p-1', quantity: 2 },
        { productId: 'p-2', quantity: 0.75 },
      ];

      expect(await service.create(message(items))).toBe(sale);
      expect(sales.createSale).toHaveBeenCalledWith(userId, items);
    });

    it('rejects a decimal quantity on a Unit product before touching stock (RN-05)', async () => {
      const error = await errorOf(
        service.create(message([{ productId: 'p-1', quantity: 1.5 }])),
      );
      expect(error).toMatchObject({ status: 400 });
      expect(error.message).toContain('Yerba');
      expect(sales.createSale).not.toHaveBeenCalled();
    });

    it('answers 409 with the code and items the frontend parses', async () => {
      const conflicts = [
        { productId: 'p-1', name: 'Yerba', requested: 5, available: 2 },
      ];
      sales.createSale.mockRejectedValue(new InsufficientStockError(conflicts));

      expect(
        await errorOf(
          service.create(message([{ productId: 'p-1', quantity: 5 }])),
        ),
      ).toEqual({
        status: 409,
        message: 'Insufficient stock',
        code: 'INSUFFICIENT_STOCK',
        items: conflicts,
      });
    });

    it('answers 400 when the total overflows the column', async () => {
      sales.createSale.mockRejectedValue(new SaleTotalTooLargeError());
      expect(
        await errorOf(
          service.create(message([{ productId: 'p-1', quantity: 1 }])),
        ),
      ).toMatchObject({ status: 400 });
    });

    it.each(['P2034', 'P2028'])(
      'answers 503 when the database gives up on the transaction (%s)',
      async (code) => {
        sales.createSale.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('busy', {
            code,
            clientVersion: 'test',
          }),
        );
        expect(
          await errorOf(
            service.create(message([{ productId: 'p-1', quantity: 1 }])),
          ),
        ).toMatchObject({ status: 503 });
      },
    );

    it('lets unknown errors through', async () => {
      const boom = new Error('boom');
      sales.createSale.mockRejectedValue(boom);
      await expect(
        service.create(message([{ productId: 'p-1', quantity: 1 }])),
      ).rejects.toBe(boom);
    });
  });

  describe('list', () => {
    const base = { page: 1, limit: 10 };

    it('rejects from after to', async () => {
      expect(
        await errorOf(
          service.list({
            ...base,
            from: '2026-11-18T00:00:00-03:00',
            to: '2026-11-17T00:00:00-03:00',
          }),
        ),
      ).toMatchObject({ status: 400 });
      expect(sales.list).not.toHaveBeenCalled();
    });

    it('wraps the rows in the paginated shape', async () => {
      sales.list.mockResolvedValue([[], 0]);
      expect((await service.list(base)).meta).toEqual({
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      });
    });
  });

  describe('get', () => {
    it('answers 404 for an unknown sale', async () => {
      sales.findById.mockResolvedValue(null);
      expect(await errorOf(service.get('sale-x'))).toMatchObject({
        status: 404,
      });
    });
  });
});
