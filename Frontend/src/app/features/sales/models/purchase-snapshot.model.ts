import { ProductUnit } from './product.model';

/** Detalle de una compra tal como se vio al generar el pago (solo para mostrar al cliente). */
export interface PurchaseSnapshot {
  saleId: string;
  items: { name: string; quantity: number; unit: ProductUnit }[];
  total: number;
  /** Momento en que se generó el pago (ms desde epoch). */
  createdAt: number;
}
