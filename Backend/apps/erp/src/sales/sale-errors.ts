import type { StockConflict } from '@app/contracts';

// Thrown inside the sale transaction so Prisma rolls everything back; the
// service turns them into RPC errors

export class InsufficientStockError extends Error {
  constructor(readonly conflicts: StockConflict[]) {
    super('Insufficient stock');
  }
}

export class SaleTotalTooLargeError extends Error {
  constructor() {
    super('Sale total exceeds the maximum amount');
  }
}
