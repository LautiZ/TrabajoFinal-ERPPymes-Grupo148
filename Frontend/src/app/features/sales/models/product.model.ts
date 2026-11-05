export type ProductUnit = 'Unit' | 'Kg' | 'Meter' | 'Liter';

/** Producto tal como lo necesita el punto de venta (precio y stock ya normalizados a number). */
export interface CatalogProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  unit: ProductUnit;
  active: boolean;
}

export const UNIT_LABELS: Record<ProductUnit, string> = {
  Unit: 'u',
  Kg: 'kg',
  Meter: 'm',
  Liter: 'l',
};

/** RN-05: solo Kg, Meter y Liter admiten cantidades decimales; Unit es siempre entero. */
export function allowsDecimals(unit: ProductUnit): boolean {
  return unit !== 'Unit';
}
