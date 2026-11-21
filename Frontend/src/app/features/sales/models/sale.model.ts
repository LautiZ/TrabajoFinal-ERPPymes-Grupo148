export type SaleState = 'Ordered' | 'Paid' | 'Dispatched' | 'Cancelled';

export interface CreateSaleItem {
  productId: string;
  quantity: number;
}

/** RN-06: el cliente nunca envía el total; solo ítems y cantidades. */
export interface CreateSaleRequest {
  items: CreateSaleItem[];
}

export interface Sale {
  id: string;
  total: number;
  currentState: SaleState;
  createdAt: string;
}

export const SALE_STATE_LABELS: Record<SaleState, string> = {
  Ordered: 'Pendiente de pago',
  Paid: 'Pagada',
  Dispatched: 'Despachada',
  Cancelled: 'Cancelada',
};

/** Fila de `GET /sales`: el listado no incluye los ítems. */
export interface SaleSummary {
  id: string;
  saleNumber: number;
  receiptNumber: number | null;
  total: number;
  currentState: SaleState;
  itemCount: number;
  createdAt: string;
}

export interface SaleItemDetail {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface SaleHistoryStep {
  state: SaleState;
  userId: string | null;
  createdAt: string;
}

/** `GET /sales/:id`: la venta con sus ítems y el historial de estados. */
export interface SaleDetail extends SaleSummary {
  items: SaleItemDetail[];
  history: SaleHistoryStep[];
}

export interface SalePage {
  data: SaleSummary[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}
