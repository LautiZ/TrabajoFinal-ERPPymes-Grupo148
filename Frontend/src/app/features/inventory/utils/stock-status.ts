export type StockStatus = 'ok' | 'low' | 'out';

/** Umbral por defecto de "stock bajo". */
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;

/**
 * Estado de stock de un producto:
 * - `out`: sin stock (0 o menos).
 * - `low`: stock en el umbral o por debajo (el umbral se interpreta como "mínimo").
 * - `ok`: stock normal.
 */
export function getStockStatus(
  stock: number,
  threshold: number = DEFAULT_LOW_STOCK_THRESHOLD,
): StockStatus {
  if (stock <= 0) {
    return 'out';
  }
  return stock <= threshold ? 'low' : 'ok';
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'Stock normal',
  low: 'Stock bajo',
  out: 'Sin stock',
};
