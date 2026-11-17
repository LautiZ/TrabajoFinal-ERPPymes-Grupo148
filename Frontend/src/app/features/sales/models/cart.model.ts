import { ProductUnit } from './product.model';

export interface CartItem {
  productId: string;
  name: string;
  sku: string;
  /** Precio informativo para mostrar totales; el total real lo calcula el backend (RN-06). */
  unitPrice: number;
  quantity: number;
  /** Último stock conocido del producto, usado para limitar la cantidad. */
  stock: number;
  unit: ProductUnit;
}
