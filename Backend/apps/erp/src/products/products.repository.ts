import { Injectable } from '@nestjs/common';
import type {
  CreateProductDto,
  ListProductsDto,
  ProductView,
  StockSummary,
  UpdateProductDto,
} from '@app/contracts';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma-errors';

const PRODUCT_SELECT = {
  id: true,
  name: true,
  sku: true,
  price: true,
  stock: true,
  lowStockThreshold: true,
  unit: true,
  categoryId: true,
  active: true,
  deleted: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof PRODUCT_SELECT }>;

// Decimal(12,3) fits a JS number exactly, so the API speaks plain numbers
const toView = (row: ProductRow): ProductView => ({
  ...row,
  price: row.price.toNumber(),
  stock: row.stock.toNumber(),
  lowStockThreshold: row.lowStockThreshold.toNumber(),
});

@Injectable()
export class ProductsRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.product.count();
  }

  async list(query: ListProductsDto): Promise<[ProductView[], number]> {
    const where = this.buildWhere(query);
    const direction = query.sortOrder;
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      query.sortBy === 'category'
        ? { category: { name: direction } }
        : { [query.sortBy]: direction },
      // Tiebreaker: without it, equal values can jump between pages
      { id: 'asc' },
    ];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        select: PRODUCT_SELECT,
      }),
      this.prisma.product.count({ where }),
    ]);
    return [rows.map(toView), total];
  }

  async stockSummary(): Promise<StockSummary> {
    const [total, low, out] = await this.prisma.$transaction([
      this.prisma.product.count({ where: { deleted: false } }),
      this.prisma.product.count({
        where: { deleted: false, ...this.lowStock() },
      }),
      this.prisma.product.count({ where: { deleted: false, stock: 0 } }),
    ]);
    return { total, low, out, ok: total - low - out };
  }

  async findById(id: string): Promise<ProductView | null> {
    const row = await this.prisma.product.findFirst({
      where: { id, deleted: false },
      select: PRODUCT_SELECT,
    });
    return row && toView(row);
  }

  // Product and its initial Income movement go in one nested write (RN-01).
  // Returns null when the SKU is taken.
  async create(
    { stock, ...data }: CreateProductDto,
    userId: string,
  ): Promise<ProductView | null> {
    try {
      const row = await this.prisma.product.create({
        data: {
          ...data,
          stock,
          // An Income must be positive (RN-03), so zero stock gets no movement
          stockMovements:
            stock > 0
              ? { create: { typeMovement: 'Income', quantity: stock, userId } }
              : undefined,
        },
        select: PRODUCT_SELECT,
      });
      return toView(row);
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  // Returns null when the new SKU is taken
  async update(
    id: string,
    data: UpdateProductDto,
  ): Promise<ProductView | null> {
    try {
      const row = await this.prisma.product.update({
        where: { id },
        data,
        select: PRODUCT_SELECT,
      });
      return toView(row);
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  // Logical delete (RN-04); false when the product does not exist or is already deleted
  async softDelete(id: string): Promise<boolean> {
    const { count } = await this.prisma.product.updateMany({
      where: { id, deleted: false },
      data: { deleted: true },
    });
    return count > 0;
  }

  /**
   * Applies a signed stock change and records its Adjustment movement in one
   * transaction. The stock check lives in the UPDATE itself, so two concurrent
   * outcomes cannot both pass a stale read (RN-02). Returns null when the
   * product is missing/deleted or the stock is not enough.
   */
  async adjustStock(
    id: string,
    delta: number,
    reason: string,
    userId: string,
  ): Promise<ProductView | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.product.updateMany({
        where: {
          id,
          deleted: false,
          ...(delta < 0 ? { stock: { gte: -delta } } : {}),
        },
        data: { stock: { increment: delta } },
      });
      if (count === 0) return null;

      await tx.stockMovement.create({
        data: {
          typeMovement: 'Adjustment',
          quantity: delta,
          reason,
          userId,
          productId: id,
        },
      });
      const row = await tx.product.findUniqueOrThrow({
        where: { id },
        select: PRODUCT_SELECT,
      });
      return toView(row);
    });
  }

  private buildWhere({
    search,
    categoryId,
    stockStatus,
  }: ListProductsDto): Prisma.ProductWhereInput {
    return {
      deleted: false,
      ...(categoryId && { categoryId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { sku: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(stockStatus === 'out' && { stock: 0 }),
      ...(stockStatus === 'low' && this.lowStock()),
    };
  }

  // Compares two columns of the same row: stock against its own threshold
  private lowStock(): Prisma.ProductWhereInput {
    return {
      AND: [
        { stock: { gt: 0 } },
        { stock: { lte: this.prisma.product.fields.lowStockThreshold } },
      ],
    };
  }
}
