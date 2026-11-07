import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { ProductListQuery } from '../models/product.model';
import { InventoryService } from './inventory.service';

export interface StockCounts {
  /** Productos del catálogo. */
  total: number;
  ok: number;
  low: number;
  out: number;
}

/**
 * Cantidad de productos en cada estado de stock. Se arma con consultas de una sola fila
 * y se lee el total de la paginación: no hace falta traer el catálogo completo.
 */
@Injectable({
  providedIn: 'root',
})
export class StockSummaryService {
  private readonly inventory = inject(InventoryService);

  load(lowStockThreshold: number): Observable<StockCounts> {
    return forkJoin({
      total: this.count({}),
      low: this.count({ stockStatus: 'low', lowStockThreshold }),
      out: this.count({ stockStatus: 'out' }),
    }).pipe(
      map(({ total, low, out }) => ({
        total,
        low,
        out,
        ok: Math.max(0, total - low - out),
      })),
    );
  }

  private count(query: ProductListQuery): Observable<number> {
    return this.inventory.list({ ...query, page: 1, limit: 1 }).pipe(map((r) => r.meta.total));
  }
}
