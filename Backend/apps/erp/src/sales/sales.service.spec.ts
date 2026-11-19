import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { SALE_CANCELLED, SALE_NOT_PAID, type SaleView } from '@app/contracts';
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
    markPaid: jest.fn(),
    cancelUnpaid: jest.fn(),
    findOrderedOlderThan: jest.fn(),
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

  describe('markPaid', () => {
    const paid = { id: 'sale-1', currentState: 'Paid' } as SaleView;

    it('moves an Ordered sale to Paid and returns it', async () => {
      sales.markPaid.mockResolvedValue(true);
      sales.findById.mockResolvedValue(paid);

      expect(await service.markPaid('sale-1')).toBe(paid);
      expect(sales.markPaid).toHaveBeenCalledWith('sale-1');
    });

    it('is safe to repeat: an already Paid sale is returned unchanged', async () => {
      sales.markPaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue(paid);

      expect(await service.markPaid('sale-1')).toBe(paid);
    });

    it('also accepts a sale that moved on to Dispatched', async () => {
      const dispatched = { ...paid, currentState: 'Dispatched' } as SaleView;
      sales.markPaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue(dispatched);

      expect(await service.markPaid('sale-1')).toBe(dispatched);
    });

    it('answers 409 SALE_CANCELLED for a cancelled sale', async () => {
      sales.markPaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue({ ...paid, currentState: 'Cancelled' });

      expect(await errorOf(service.markPaid('sale-1'))).toMatchObject({
        status: 409,
        code: SALE_CANCELLED,
      });
    });

    it('answers 404 for an unknown sale', async () => {
      sales.markPaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue(null);

      expect(await errorOf(service.markPaid('sale-x'))).toMatchObject({
        status: 404,
      });
    });

    // markPaid and cancelUnpaid race on the same row: if the cancel wins,
    // the payment gets SALE_CANCELLED (Payments logs a refund)
    it('answers 409 SALE_CANCELLED when a cancel won the race', async () => {
      sales.markPaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue({
        id: 'sale-1',
        currentState: 'Cancelled',
      });

      expect(await errorOf(service.markPaid('sale-1'))).toMatchObject({
        status: 409,
        code: SALE_CANCELLED,
      });
    });
  });

  describe('cancel', () => {
    const cancelled = { id: 'sale-1', currentState: 'Cancelled' } as SaleView;

    it('cancels an Ordered sale and returns it', async () => {
      sales.cancelUnpaid.mockResolvedValue(true);
      sales.findById.mockResolvedValue(cancelled);

      expect(await service.cancel('sale-1')).toBe(cancelled);
      expect(sales.cancelUnpaid).toHaveBeenCalledWith('sale-1');
    });

    it('is safe to repeat: an already cancelled sale is returned as is', async () => {
      sales.cancelUnpaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue(cancelled);

      expect(await service.cancel('sale-1')).toBe(cancelled);
    });

    // If the payment won the race, the caller sees Paid and keeps the sale
    it('leaves a paid sale untouched and returns it', async () => {
      const paid = { id: 'sale-1', currentState: 'Paid' } as SaleView;
      sales.cancelUnpaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue(paid);

      expect(await service.cancel('sale-1')).toBe(paid);
    });

    it('answers 404 for an unknown sale', async () => {
      sales.cancelUnpaid.mockResolvedValue(false);
      sales.findById.mockResolvedValue(null);

      expect(await errorOf(service.cancel('sale-x'))).toMatchObject({
        status: 404,
      });
    });
  });

  describe('cancelExpired', () => {
    const cutoff = 90;

    it('cancels every Ordered sale older than the given minutes', async () => {
      sales.findOrderedOlderThan.mockResolvedValue(['s-1', 's-2']);
      sales.cancelUnpaid.mockResolvedValue(true);

      expect(await service.cancelExpired(cutoff)).toBe(2);
      expect(sales.findOrderedOlderThan).toHaveBeenCalledWith(90, 50);
      expect(sales.cancelUnpaid).toHaveBeenCalledTimes(2);
    });

    it('does not count sales paid between the query and the cancel', async () => {
      sales.findOrderedOlderThan.mockResolvedValue(['s-1', 's-2']);
      sales.cancelUnpaid
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      expect(await service.cancelExpired(cutoff)).toBe(1);
    });

    it('keeps going when one sale fails', async () => {
      sales.findOrderedOlderThan.mockResolvedValue(['s-1', 's-2']);
      sales.cancelUnpaid
        .mockRejectedValueOnce(new Error('deadlock'))
        .mockResolvedValueOnce(true);

      expect(await service.cancelExpired(cutoff)).toBe(1);
    });
  });

  describe('receipt', () => {
    const paidAt = new Date('2026-11-18T23:37:07Z');
    const items = [
      {
        productId: 'p-1',
        name: 'Queso',
        sku: 'QUE',
        quantity: 1,
        unitPrice: 9800,
        subtotal: 9800,
      },
    ];
    const paidSale = {
      id: 'sale-1',
      saleNumber: 113,
      receiptNumber: 123,
      total: 9800,
      currentState: 'Paid',
      userId: 'user-1',
      items,
      history: [
        {
          state: 'Ordered',
          userId: 'user-1',
          createdAt: new Date('2026-11-18T23:25:00Z'),
        },
        { state: 'Paid', userId: null, createdAt: paidAt },
      ],
    } as unknown as SaleView;

    it('returns the receipt of a paid sale with its formatted number', async () => {
      sales.findById.mockResolvedValue(paidSale);

      await expect(service.receipt('sale-1')).resolves.toEqual({
        receiptNumber: '0001-00000123',
        saleId: 'sale-1',
        saleNumber: 113,
        issuedAt: paidAt,
        sellerId: 'user-1',
        items,
        total: 9800,
      });
    });

    it('keeps the receipt of a dispatched sale (it was paid first)', async () => {
      sales.findById.mockResolvedValue({
        ...paidSale,
        currentState: 'Dispatched',
      });

      expect((await service.receipt('sale-1')).receiptNumber).toBe(
        '0001-00000123',
      );
    });

    it.each(['Ordered', 'Cancelled'])(
      'answers 409 SALE_NOT_PAID for a sale in %s',
      async (currentState) => {
        sales.findById.mockResolvedValue({
          ...paidSale,
          currentState,
          receiptNumber: null,
        });

        expect(await errorOf(service.receipt('sale-1'))).toMatchObject({
          status: 409,
          code: SALE_NOT_PAID,
        });
      },
    );

    it('answers 404 for an unknown sale', async () => {
      sales.findById.mockResolvedValue(null);

      expect(await errorOf(service.receipt('sale-x'))).toMatchObject({
        status: 404,
      });
    });
  });
});
