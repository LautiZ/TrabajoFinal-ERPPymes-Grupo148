import { PaginationQuery } from '../../../core/models/pagination.model';

export type ProductUnit = 'Unit' | 'Kg' | 'Meter' | 'Liter';

export const PRODUCT_UNITS: readonly ProductUnit[] = ['Unit', 'Kg', 'Meter', 'Liter'];

export const UNIT_LABELS: Record<ProductUnit, string> = {
  Unit: 'Unidad',
  Kg: 'Kilogramo',
  Meter: 'Metro',
  Liter: 'Litro',
};

export const UNIT_SYMBOLS: Record<ProductUnit, string> = {
  Unit: 'u',
  Kg: 'kg',
  Meter: 'm',
  Liter: 'l',
};

/** RN-05: solo Kg, Meter y Liter admiten cantidades decimales; Unit es siempre entero. */
export function allowsDecimals(unit: ProductUnit): boolean {
  return unit !== 'Unit';
}

export interface Category {
  id: string;
  name: string;
}

/** Producto del catálogo tal como lo usa la UI (decimales ya normalizados a number). */
export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  /** Mínimo propio del producto: está en "stock bajo" cuando `stock <= lowStockThreshold`. 0 = sin alerta. */
  lowStockThreshold: number;
  unit: ProductUnit;
  categoryId: string;
  category: Category | null;
  /** `false` = pausado para la venta (RN-04). */
  active: boolean;
  /** Baja lógica: un producto eliminado no vuelve a aparecer en operaciones nuevas. */
  deleted: boolean;
}

export interface CreateProductDto {
  name: string;
  sku: string;
  price: number;
  /** Stock inicial. Después de creado solo cambia con movimientos de stock (RN-01). */
  stock: number;
  unit: ProductUnit;
  categoryId: string;
  active?: boolean;
  lowStockThreshold?: number;
}

/** El stock no se edita directamente (RN-01): se ajusta con `adjustStock`. */
export interface UpdateProductDto {
  name?: string;
  sku?: string;
  price?: number;
  unit?: ProductUnit;
  categoryId?: string;
  active?: boolean;
  lowStockThreshold?: number;
}

export type StockMovementType = 'Income' | 'Outcome';

/** Movimiento manual de stock: la cantidad siempre es positiva (RN-03). */
export interface AdjustStockDto {
  type: StockMovementType;
  quantity: number;
  reason: string;
}

export type ProductSortField = 'name' | 'sku' | 'category' | 'price' | 'stock';

/** Conteo de productos por estado de stock (`GET /products/stock-summary`). */
export interface StockSummaryCounts {
  total: number;
  ok: number;
  low: number;
  out: number;
}

export type StockStatusFilter = 'low' | 'out';

export interface ProductListQuery extends PaginationQuery {
  sortBy?: ProductSortField;
  categoryId?: string;
  /** `low`: stock en o por debajo del mínimo de cada producto; `out`: sin stock. */
  stockStatus?: StockStatusFilter;
}
