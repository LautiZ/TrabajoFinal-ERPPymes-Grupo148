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
