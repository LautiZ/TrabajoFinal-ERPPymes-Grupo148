export type StockStatus = 'ok' | 'low' | 'out';

/**
 * Estado de stock de un producto según su propio mínimo (`lowStockThreshold`):
 * - `out`: sin stock (0 o menos).
 * - `low`: stock en el mínimo o por debajo; un mínimo de 0 significa "sin alerta".
 * - `ok`: stock normal.
 */
export function getStockStatus(stock: number, lowStockThreshold = 0): StockStatus {
  if (stock <= 0) {
    return 'out';
  }
  return lowStockThreshold > 0 && stock <= lowStockThreshold ? 'low' : 'ok';
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'Stock normal',
  low: 'Stock bajo',
  out: 'Sin stock',
};
