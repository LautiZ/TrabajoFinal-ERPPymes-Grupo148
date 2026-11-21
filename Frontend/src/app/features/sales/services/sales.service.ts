import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CartItem } from '../models/cart.model';
import {
  CreateSaleRequest,
  Sale,
  SaleDetail,
  SalePage,
  SaleState,
} from '../models/sale.model';

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

  /** Ventas más recientes primero. */
  listSales(page: number, limit: number): Observable<SalePage> {
    return this.api
      .get<SalePage>('sales', { page, limit })
      .pipe(map((res) => ({ ...res, data: res.data.map((s) => ({ ...s, total: Number(s.total) })) })));
  }

  getSaleDetail(id: string): Observable<SaleDetail> {
    return this.api.get<SaleDetail>(`sales/${encodeURIComponent(id)}`);
  }

  /** Solo ventas en Ordered: devuelve el stock (RN-09.1, RN-11). */
  cancelSale(id: string): Observable<SaleDetail> {
    return this.api.post<SaleDetail>(`sales/${encodeURIComponent(id)}/cancel`, {});
  }

  /** Solo ventas en Paid (RN-09). */
  dispatchSale(id: string): Observable<SaleDetail> {
    return this.api.post<SaleDetail>(`sales/${encodeURIComponent(id)}/dispatch`, {});
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
