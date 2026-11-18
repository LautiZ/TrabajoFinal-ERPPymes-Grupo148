import { Injectable } from '@nestjs/common';
import {
  INSUFFICIENT_STOCK,
  paginate,
  SALE_CANCELLED,
  type CreateSaleMessage,
  type ListSalesDto,
  type PaginatedResponse,
  type SaleSummaryView,
  type SaleView,
} from '@app/contracts';
import { rpcError } from '../common/rpc-error';
import { isTransientTransactionError } from '../prisma/prisma-errors';
import { InsufficientStockError, SaleTotalTooLargeError } from './sale-errors';
import { SalesRepository } from './sales.repository';

@Injectable()
export class SalesService {
  constructor(private readonly salesRepository: SalesRepository) {}

  async create({ userId, sale }: CreateSaleMessage): Promise<SaleView> {
    await this.assertWholeQuantitiesForUnit(sale.items);

    try {
      return await this.salesRepository.createSale(userId, sale.items);
    } catch (err) {
      // Same shape the frontend parses to show which items no longer fit (TES-64)
      if (err instanceof InsufficientStockError) {
        throw rpcError(409, 'Insufficient stock', {
          code: INSUFFICIENT_STOCK,
          items: err.conflicts,
        });
      }
      if (err instanceof SaleTotalTooLargeError) {
        throw rpcError(400, err.message);
      }
      // Under heavy concurrency the database can give up on the transaction;
      // nothing was written, so the cashier can simply retry
      if (isTransientTransactionError(err)) {
        throw rpcError(503, 'Too many concurrent sales, please retry');
      }
      throw err;
    }
  }

  async list(query: ListSalesDto): Promise<PaginatedResponse<SaleSummaryView>> {
    if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
      throw rpcError(400, 'from must not be after to');
    }
    const [data, total] = await this.salesRepository.list(query);
    return paginate(data, total, query);
  }

  async get(id: string): Promise<SaleView> {
    const sale = await this.salesRepository.findById(id);
    if (!sale) throw rpcError(404, 'Sale not found');
    return sale;
  }

  // Called by Payments when Mercado Pago confirms the payment. Safe to repeat:
  // the webhook can arrive several times, and only the first call changes the sale
  async markPaid(id: string): Promise<SaleView> {
    const changed = await this.salesRepository.markPaid(id);
    const sale = await this.get(id);
    if (!changed && sale.currentState === 'Cancelled') {
      throw rpcError(409, 'Sale was cancelled before the payment arrived', {
        code: SALE_CANCELLED,
      });
    }
    // Paid by this call, or already Paid/Dispatched by an earlier one
    return sale;
  }

  // RN-05: a malformed quantity is a 400, not a stock conflict
  private async assertWholeQuantitiesForUnit(
    items: CreateSaleMessage['sale']['items'],
  ): Promise<void> {
    const products = await this.salesRepository.findProducts(
      items.map((item) => item.productId),
    );
    const unitOf = new Map(products.map((p) => [p.id, p]));
    const invalid = items.filter(
      (item) =>
        unitOf.get(item.productId)?.unit === 'Unit' &&
        !Number.isInteger(item.quantity),
    );
    if (invalid.length > 0) {
      const names = invalid.map((item) => unitOf.get(item.productId)!.name);
      throw rpcError(
        400,
        `Quantity must be a whole number for Unit products: ${names.join(', ')}`,
      );
    }
  }
}
