import { randomUUID } from 'crypto';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { INSUFFICIENT_STOCK } from '@app/contracts';
import { PrismaService } from '../src/prisma/prisma.service';
import { SalesRepository } from '../src/sales/sales.repository';
import { SalesService } from '../src/sales/sales.service';

// Integration tests against a real Postgres (TES-26, TES-25): the guarantees
// below live in SQL (conditional updates, row locks, sequences), so mocks
// cannot prove them. Run with: pnpm test:int:erp

const userId = randomUUID();

const rpcPayload = (err: unknown) =>
  err instanceof RpcException
    ? (err.getError() as { status: number; code?: string })
    : undefined;

describe('ERP sales against a real database', () => {
  let prisma: PrismaService;
  let service: SalesService;
  let repository: SalesRepository;
  let categoryId: string;

  const createProduct = async (stock: number, sku = randomUUID()) => {
    const product = await prisma.product.create({
      data: {
        name: `Product ${sku.slice(0, 6)}`,
        sku,
        price: 100,
        stock,
        unit: 'Unit',
        categoryId,
      },
    });
    return product.id;
  };

  const stockOf = async (productId: string) =>
    (
      await prisma.product.findUniqueOrThrow({ where: { id: productId } })
    ).stock.toNumber();

  const sell = (items: { productId: string; quantity: number }[]) =>
    service.create({ userId, sale: { items } });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, SalesRepository, SalesService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(SalesService);
    repository = moduleRef.get(SalesRepository);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // RESTART IDENTITY also resets the receipt sequence (owned by sales)
    await prisma.$executeRawUnsafe(
      'TRUNCATE erp.stock_movements, erp.sale_history, erp.sale_items, erp.sales, erp.products, erp.categories RESTART IDENTITY CASCADE',
    );
    categoryId = (
      await prisma.category.create({ data: { name: 'Test category' } })
    ).id;
  });

  describe('concurrent sales (TES-25)', () => {
    // Acceptance criterion of TES-25: N simultaneous purchases of a product
    // with limited stock never sell more than available, never go negative
    it('30 simultaneous purchases of 1 unit with stock 10 sell exactly 10', async () => {
      const productId = await createProduct(10);

      const results = await Promise.allSettled(
        Array.from({ length: 30 }, () => sell([{ productId, quantity: 1 }])),
      );

      const sold = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(sold).toHaveLength(10);
      expect(rejected).toHaveLength(20);
      for (const r of rejected) {
        expect(rpcPayload(r.reason)).toMatchObject({
          status: 409,
          code: INSUFFICIENT_STOCK,
        });
      }
      expect(await stockOf(productId)).toBe(0);

      // One Outcome movement per sale, and nothing written for the losers
      const outcome = await prisma.stockMovement.aggregate({
        where: { productId, typeMovement: 'Outcome' },
        _sum: { quantity: true },
        _count: true,
      });
      expect(outcome._count).toBe(10);
      expect(outcome._sum.quantity?.toNumber()).toBe(10);
      expect(await prisma.sale.count()).toBe(10);
    });

    it('never goes negative when each purchase takes more than one unit', async () => {
      const productId = await createProduct(5);

      const results = await Promise.allSettled(
        Array.from({ length: 10 }, () => sell([{ productId, quantity: 2 }])),
      );

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
      expect(await stockOf(productId)).toBe(1);
    });

    // Sales lock products in productId order, so opposite item orders cannot
    // deadlock (a deadlock would surface as a 503 or a Postgres error)
    it('sales with the same products in opposite order do not deadlock', async () => {
      const a = await createProduct(100);
      const b = await createProduct(100);

      const results = await Promise.allSettled(
        Array.from({ length: 40 }, (_, i) =>
          sell(
            i % 2 === 0
              ? [
                  { productId: a, quantity: 1 },
                  { productId: b, quantity: 1 },
                ]
              : [
                  { productId: b, quantity: 1 },
                  { productId: a, quantity: 1 },
                ],
          ),
        ),
      );

      expect(results.filter((r) => r.status === 'rejected')).toEqual([]);
      expect(await stockOf(a)).toBe(60);
      expect(await stockOf(b)).toBe(60);
    });

    it('rolls back the whole sale when one item is short', async () => {
      const plenty = await createProduct(50);
      const scarce = await createProduct(1);

      await expect(
        sell([
          { productId: plenty, quantity: 5 },
          { productId: scarce, quantity: 2 },
        ]),
      ).rejects.toBeInstanceOf(RpcException);

      expect(await stockOf(plenty)).toBe(50);
      expect(await stockOf(scarce)).toBe(1);
      expect(await prisma.sale.count()).toBe(0);
    });
  });

  describe('state changes', () => {
    it('assigns consecutive receipt numbers and never burns one on a repeat', async () => {
      const productId = await createProduct(10);
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push((await sell([{ productId, quantity: 1 }])).id);
      }

      expect((await service.markPaid(ids[0])).receiptNumber).toBe(1);
      // Same notification again: same number, nothing consumed
      expect((await service.markPaid(ids[0])).receiptNumber).toBe(1);
      expect((await service.markPaid(ids[1])).receiptNumber).toBe(2);
      expect((await service.markPaid(ids[2])).receiptNumber).toBe(3);

      const paid = await service.get(ids[0]);
      expect(paid.history.map((h) => [h.state, h.userId])).toEqual([
        ['Ordered', userId],
        ['Paid', null],
      ]);
    });

    it('cancelling returns the stock once, keeping the original movements (RN-11)', async () => {
      const productId = await createProduct(10);
      const sale = await sell([{ productId, quantity: 3 }]);
      expect(await stockOf(productId)).toBe(7);

      expect((await service.cancel(sale.id)).currentState).toBe('Cancelled');
      expect(await service.cancel(sale.id)).toMatchObject({
        currentState: 'Cancelled',
      });

      expect(await stockOf(productId)).toBe(10);
      const movements = await prisma.stockMovement.findMany({
        where: { saleId: sale.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(
        movements.map((m) => [m.typeMovement, m.quantity.toNumber()]),
      ).toEqual([
        ['Outcome', 3],
        ['Income', 3],
      ]);
      const history = await service.get(sale.id);
      expect(history.history.at(-1)).toMatchObject({
        state: 'Cancelled',
        userId: null,
      });
    });

    it('does not cancel a paid sale', async () => {
      const productId = await createProduct(10);
      const sale = await sell([{ productId, quantity: 1 }]);
      await service.markPaid(sale.id);

      expect((await service.cancel(sale.id)).currentState).toBe('Paid');
      expect(await stockOf(productId)).toBe(9);
    });

    // The webhook (markPaid) and the expiration job or a failed payment
    // (cancel) can hit the same sale at once: exactly one must win, and the
    // stock and receipt must match the winner
    it('a payment and a cancel racing on the same sale leave it consistent', async () => {
      const productId = await createProduct(100);

      for (let round = 0; round < 15; round++) {
        const sale = await sell([{ productId, quantity: 2 }]);
        const [paid, cancelled] = await Promise.allSettled([
          service.markPaid(sale.id),
          service.cancel(sale.id),
        ]);

        const final = await service.get(sale.id);
        if (final.currentState === 'Paid') {
          expect(paid.status).toBe('fulfilled');
          expect(final.receiptNumber).not.toBeNull();
          expect(cancelled).toMatchObject({
            status: 'fulfilled',
            value: { currentState: 'Paid' },
          });
        } else {
          expect(final.currentState).toBe('Cancelled');
          expect(final.receiptNumber).toBeNull();
          expect(paid.status).toBe('rejected');
        }
      }

      // Every cancelled sale returned its 2 units; every paid one kept them
      const paidCount = await prisma.sale.count({
        where: { currentState: 'Paid' },
      });
      expect(await stockOf(productId)).toBe(100 - 2 * paidCount);
    });
  });

  describe('expiration job query', () => {
    it('finds only Ordered sales older than the given minutes, oldest first', async () => {
      const productId = await createProduct(10);
      const old = await sell([{ productId, quantity: 1 }]);
      const older = await sell([{ productId, quantity: 1 }]);
      const fresh = await sell([{ productId, quantity: 1 }]);
      const paidOld = await sell([{ productId, quantity: 1 }]);
      await service.markPaid(paidOld.id);
      await prisma.$executeRaw`UPDATE erp.sales SET created_at = now() - interval '2 hours' WHERE id = ${old.id}::uuid OR id = ${paidOld.id}::uuid`;
      await prisma.$executeRaw`UPDATE erp.sales SET created_at = now() - interval '3 hours' WHERE id = ${older.id}::uuid`;

      expect(await repository.findOrderedOlderThan(90, 50)).toEqual([
        older.id,
        old.id,
      ]);
      expect(await service.cancelExpired(90)).toBe(2);
      expect((await service.get(fresh.id)).currentState).toBe('Ordered');
      expect(await stockOf(productId)).toBe(8);
    });
  });
});
