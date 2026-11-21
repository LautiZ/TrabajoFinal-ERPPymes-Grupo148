import { Injectable } from '@nestjs/common';
import type { ListStockMovementsDto, MovementType } from '@app/contracts';
import { PrismaService } from '../prisma/prisma.service';

export interface StockMovementRow {
  id: string;
  type: MovementType;
  /** Signed for Adjustments (RN-03), positive otherwise */
  quantity: number;
  reason: string | null;
  saleNumber: number | null;
  product: { id: string; name: string; sku: string };
  createdAt: Date;
}

@Injectable()
export class StockMovementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Deleted products keep their movements: the history must stay complete
  async list({
    page,
    limit,
  }: ListStockMovementsDto): Promise<[StockMovementRow[], number]> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          typeMovement: true,
          quantity: true,
          reason: true,
          createdAt: true,
          product: { select: { id: true, name: true, sku: true } },
          sale: { select: { saleNumber: true } },
        },
      }),
      this.prisma.stockMovement.count(),
    ]);
    return [
      rows.map((row) => ({
        id: row.id,
        type: row.typeMovement,
        quantity: row.quantity.toNumber(),
        reason: row.reason,
        saleNumber: row.sale?.saleNumber ?? null,
        product: row.product,
        createdAt: row.createdAt,
      })),
      total,
    ];
  }
}
