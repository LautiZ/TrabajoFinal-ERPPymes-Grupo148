import { Injectable } from '@nestjs/common';
import {
  MAX_PRICE,
  type ListSalesDto,
  type ProductUnit,
  type SaleItemDto,
  type SaleSummaryView,
  type SaleView,
  type StockConflict,
} from '@app/contracts';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { applyStockDelta } from '../stock/apply-stock-delta';
import { InsufficientStockError, SaleTotalTooLargeError } from './sale-errors';

const SUMMARY_SELECT = {
  id: true,
  saleNumber: true,
  receiptNumber: true,
  total: true,
  currentState: true,
  userId: true,
  createdAt: true,
  _count: { select: { items: true } },
} satisfies Prisma.SaleSelect;

const SALE_SELECT = {
  ...SUMMARY_SELECT,
  items: {
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
      product: { select: { name: true, sku: true } },
    },
    orderBy: { product: { name: 'asc' } },
  },
  history: {
    select: { saleState: true, userId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.SaleSelect;

type SummaryRow = Prisma.SaleGetPayload<{ select: typeof SUMMARY_SELECT }>;
type SaleRow = Prisma.SaleGetPayload<{ select: typeof SALE_SELECT }>;

// Money rule: each line is rounded half-up to 2 decimals and the total is the
// sum of the rounded lines, so the lines shown always add up to the total
const lineAmount = (
  unitPrice: Prisma.Decimal,
  quantity: Prisma.Decimal | number,
) => unitPrice.mul(quantity).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

const toSummary = ({ _count, ...row }: SummaryRow): SaleSummaryView => ({
  ...row,
  total: row.total.toNumber(),
  itemCount: _count.items,
});

const toView = ({ items, history, ...row }: SaleRow): SaleView => ({
  ...toSummary(row),
  items: items.map((item) => ({
    productId: item.productId,
    name: item.product.name,
    sku: item.product.sku,
    quantity: item.quantity.toNumber(),
    unitPrice: item.unitPrice.toNumber(),
    subtotal: lineAmount(item.unitPrice, item.quantity).toNumber(),
  })),
  history: history.map((h) => ({
    state: h.saleState,
    userId: h.userId,
    createdAt: h.createdAt,
  })),
});

export interface SaleProductInfo {
  id: string;
  name: string;
  unit: ProductUnit;
}

@Injectable()
export class SalesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Includes deleted and paused products: the service only needs their unit (RN-05)
  findProducts(ids: string[]): Promise<SaleProductInfo[]> {
    return this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, unit: true },
    });
  }

  /**
   * Creates the sale in Ordered and reserves its stock in one transaction.
   * Items are processed in productId order: two sales that share products
   * always lock the rows in the same order, so they cannot deadlock.
   * Throws InsufficientStockError (listing every failing item) or
   * SaleTotalTooLargeError; either one rolls the whole sale back.
   */
  createSale(userId: string, items: SaleItemDto[]): Promise<SaleView> {
    const sorted = [...items].sort((a, b) =>
      a.productId.localeCompare(b.productId),
    );
    const ids = sorted.map((item) => item.productId);

    return this.prisma.$transaction(async (tx) => {
      // Sequential on purpose: Promise.all would lock the rows in any order
      const failed: SaleItemDto[] = [];
      for (const item of sorted) {
        const reserved = await applyStockDelta(
          tx,
          item.productId,
          -item.quantity,
          { onlyActive: true },
        );
        if (!reserved) failed.push(item);
      }
      if (failed.length > 0) {
        throw new InsufficientStockError(await this.conflicts(tx, failed));
      }

      // Read after the updates: this transaction holds the row locks, so the
      // prices cannot change until it commits (RN-07 snapshot)
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, price: true },
      });
      const priceOf = new Map(products.map((p) => [p.id, p.price]));
      const lines = sorted.map((item) => {
        const unitPrice = priceOf.get(item.productId)!;
        return {
          ...item,
          unitPrice,
          amount: lineAmount(unitPrice, item.quantity),
        };
      });
      const total = lines.reduce(
        (sum, line) => sum.add(line.amount),
        new Prisma.Decimal(0),
      );
      if (total.greaterThan(MAX_PRICE)) throw new SaleTotalTooLargeError();

      const sale = await tx.sale.create({
        data: {
          total,
          userId,
          currentState: 'Ordered',
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
            })),
          },
          // Outcome quantities are positive (RN-03); saleId is set by the nested write
          stockMovements: {
            create: lines.map((line) => ({
              typeMovement: 'Outcome' as const,
              quantity: line.quantity,
              productId: line.productId,
              userId,
            })),
          },
          // First step of the state history (RN-09)
          history: { create: { saleState: 'Ordered', userId } },
        },
        select: SALE_SELECT,
      });
      return toView(sale);
    });
  }

  async list(query: ListSalesDto): Promise<[SaleSummaryView[], number]> {
    const where: Prisma.SaleWhereInput = {
      ...(query.state && { currentState: query.state }),
      ...((query.from || query.to) && {
        createdAt: {
          ...(query.from && { gte: new Date(query.from) }),
          ...(query.to && { lt: new Date(query.to) }),
        },
      }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: SUMMARY_SELECT,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return [rows.map(toSummary), total];
  }

  /**
   * Moves the sale from Ordered to Paid in one transaction: state, receipt
   * number and history step (RN-09). The conditional update locks the row,
   * so of two concurrent calls only one sees count 1; the other gets false.
   * The receipt number is drawn only after the state changed, so a repeated
   * call never burns a number. nextval is not rolled back, though: if this
   * transaction fails after it, that number is lost (rare, accepted gap).
   */
  markPaid(id: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.sale.updateMany({
        where: { id, currentState: 'Ordered' },
        data: { currentState: 'Paid' },
      });
      if (count === 0) return false;

      const [{ next }] = await tx.$queryRaw<{ next: number }[]>`
        SELECT nextval('erp.sales_receipt_number_seq')::int AS next`;
      await tx.sale.update({
        where: { id },
        data: {
          receiptNumber: next,
          // System change: no user behind a payment webhook (RN-10)
          history: { create: { saleState: 'Paid', userId: null } },
        },
      });
      return true;
    });
  }

  async findById(id: string): Promise<SaleView | null> {
    const row = await this.prisma.sale.findUnique({
      where: { id },
      select: SALE_SELECT,
    });
    return row && toView(row);
  }

  // What the cashier can still sell: 0 for missing, deleted or paused products
  private async conflicts(
    tx: Prisma.TransactionClient,
    failed: SaleItemDto[],
  ): Promise<StockConflict[]> {
    const rows = await tx.product.findMany({
      where: { id: { in: failed.map((item) => item.productId) } },
      select: {
        id: true,
        name: true,
        stock: true,
        active: true,
        deleted: true,
      },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return failed.map((item) => {
      const row = byId.get(item.productId);
      const sellable = row && row.active && !row.deleted;
      return {
        productId: item.productId,
        name: row?.name ?? '',
        requested: item.quantity,
        available: sellable ? row.stock.toNumber() : 0,
      };
    });
  }
}
