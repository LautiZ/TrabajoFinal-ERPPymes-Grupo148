import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import { ApiService } from '../../../core/services/api.service';
import { StockMovement } from '../models/stock-movement.model';

@Injectable({
  providedIn: 'root',
})
export class StockMovementsService {
  private readonly api = inject(ApiService);

  /** Movimientos de stock de todos los productos, más nuevos primero. */
  list(page: number, limit: number): Observable<PaginatedResponse<StockMovement>> {
    return this.api.get<PaginatedResponse<StockMovement>>('stock-movements', { page, limit }).pipe(
      map((res) => ({
        ...res,
        data: res.data.map((m) => ({ ...m, quantity: Number(m.quantity) })),
      })),
    );
  }
}
