import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CartItem } from '../models/cart.model';
import { CreateSaleRequest, Sale, SaleState } from '../models/sale.model';

interface ApiSale {
  id: string;
  total: number | string;
  currentState?: SaleState;
  state?: SaleState;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SalesService {
  private readonly api = inject(ApiService);

  /** Registra la venta en estado Ordered. El total lo calcula el backend (RN-06). */
  createSale(items: readonly CartItem[]): Observable<Sale> {
    const body: CreateSaleRequest = {
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    };
    return this.api.post<ApiSale>('sales', body).pipe(map(toSale));
  }

  getSale(id: string): Observable<Sale> {
    return this.api.get<ApiSale>(`sales/${encodeURIComponent(id)}`).pipe(map(toSale));
  }
}

function toSale(raw: ApiSale): Sale {
  return {
    id: raw.id,
    total: Number(raw.total),
    currentState: raw.currentState ?? raw.state ?? 'Ordered',
    createdAt: raw.createdAt ?? '',
  };
}
