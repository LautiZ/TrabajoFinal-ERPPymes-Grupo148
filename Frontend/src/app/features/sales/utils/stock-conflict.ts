import { HttpErrorResponse } from '@angular/common/http';
import { StockConflict } from '../models/stock-conflict.model';

const CONFLICT_STATUSES = [409, 422];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function pickNumber(source: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = Number(source[key]);
    if (source[key] !== undefined && source[key] !== null && Number.isFinite(value)) {
      return value;
    }
  }
  return null;
}

/**
 * Interpreta el error del backend cuando el stock cambió entre agregar al carrito y
 * confirmar la venta (control de concurrencia, TES-25).
 *
 * - `null`: el error no es de stock insuficiente.
 * - `[]`: es de stock pero el backend no detalló los ítems (hay que re-consultar el stock).
 * - lista: ítems con la cantidad pedida y la disponible.
 */
export function parseStockConflicts(error: unknown): StockConflict[] | null {
  if (!(error instanceof HttpErrorResponse) || !CONFLICT_STATUSES.includes(error.status)) {
    return null;
  }
  const body = asRecord(error.error);
  if (!body) {
    return null;
  }
  const nested = asRecord(body['error']);
  const rawItems = body['items'] ?? body['details'] ?? nested?.['items'];
  const isStockError = body['code'] === 'INSUFFICIENT_STOCK' || Array.isArray(rawItems);
  if (!isStockError) {
    return null;
  }
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const conflicts: StockConflict[] = [];
  for (const entry of rawItems) {
    const item = asRecord(entry);
    const productId = item?.['productId'] ?? item?.['product_id'];
    if (!item || typeof productId !== 'string') {
      continue;
    }
    const available = pickNumber(item, 'available', 'stock');
    if (available === null) {
      continue;
    }
    conflicts.push({
      productId,
      name: typeof item['name'] === 'string' ? item['name'] : '',
      requested: pickNumber(item, 'requested', 'quantity') ?? 0,
      available,
    });
  }
  return conflicts;
}
