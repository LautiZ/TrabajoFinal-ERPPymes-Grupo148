import { Injectable, Logger } from '@nestjs/common';
import {
  INSUFFICIENT_STOCK,
  paginate,
  RECEIPT_POINT_OF_SALE,
  SALE_CANCELLED,
  SALE_NOT_PAID,
  type CreateSaleMessage,
  type ListSalesDto,
  type PaginatedResponse,
  type SaleReceiptView,
  type SaleState,
  type SaleSummaryView,
  type SaleView,
} from '@app/contracts';
import { rpcError } from '../common/rpc-error';
import { isTransientTransactionError } from '../prisma/prisma-errors';
import { InsufficientStockError, SaleTotalTooLargeError } from './sale-errors';
import { SalesRepository } from './sales.repository';

const RECEIPT_STATES: readonly SaleState[] = ['Paid', 'Dispatched'];

// 0001-00000123: point of sale and the correlative padded to 8 digits
export const formatReceiptNumber = (n: number) =>
  `${RECEIPT_POINT_OF_SALE}-${String(n).padStart(8, '0')}`;

// One run of the expiration job cancels at most this many sales; the rest
// wait for the next run
export const EXPIRATION_BATCH_SIZE = 50;

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

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

  // Receipt data of a paid sale (TES-76). Dispatched sales were paid first,
  // so they keep their receipt. The number was assigned by markPaid.
  async receipt(id: string): Promise<SaleReceiptView> {
    const sale = await this.get(id);
    const paidAt = sale.history.find((step) => step.state === 'Paid');
    if (
      !RECEIPT_STATES.includes(sale.currentState) ||
      sale.receiptNumber === null ||
      !paidAt
    ) {
      throw rpcError(
        409,
        `Sale is not paid (current state: ${sale.currentState})`,
        { code: SALE_NOT_PAID },
      );
    }
    return {
      receiptNumber: formatReceiptNumber(sale.receiptNumber),
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      issuedAt: paidAt.createdAt,
      sellerId: sale.userId,
      items: sale.items,
      total: sale.total,
    };
  }

  // Called by Payments when the payment fails or expires (TES-75). Only an
  // Ordered sale is cancelled; any other state is returned unchanged, so the
  // caller can tell "cancelled now or before" from "already paid".
  async cancel(id: string): Promise<SaleView> {
    await this.salesRepository.cancelUnpaid(id);
    return this.get(id);
  }

  // Expiration job: unpaid sales past their payment window release their
  // stock. Each sale is its own transaction; a failure does not stop the rest.
  async cancelExpired(olderThanMinutes: number): Promise<number> {
    const ids = await this.salesRepository.findOrderedOlderThan(
      olderThanMinutes,
      EXPIRATION_BATCH_SIZE,
    );
    let cancelled = 0;
    for (const id of ids) {
      try {
        if (await this.salesRepository.cancelUnpaid(id)) cancelled++;
      } catch (err) {
        this.logger.error(
          `Could not cancel expired sale ${id}: ${String(err)}`,
        );
      }
    }
    return cancelled;
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
