import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { PaginatedResponse, PaginationQuery } from '../../../core/models/pagination.model';
import { ApiService } from '../../../core/services/api.service';
import { CatalogProduct, ProductUnit } from '../models/product.model';

/** Forma cruda del ERP MS: los decimales de PostgreSQL pueden llegar como string. */
interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  stock: number | string;
  unit: ProductUnit;
  active?: boolean;
  deleted?: boolean;
}

/**
 * Acceso de solo lectura al catálogo para el punto de venta.
 * Es un adaptador acotado a Ventas; cuando el módulo de Inventario exponga su
 * InventoryService (TES-52) puede reemplazarse por él sin tocar los componentes.
 */
@Injectable({
  providedIn: 'root',
})
export class CatalogService {
  private readonly api = inject(ApiService);

  search(query: PaginationQuery = {}): Observable<PaginatedResponse<CatalogProduct>> {
    return this.api
      .get<PaginatedResponse<ApiProduct>>('products', {
        page: query.page ?? 1,
        limit: query.limit ?? 24,
        search: query.search,
        active: true,
      })
      .pipe(
        map((response) => ({
          ...response,
          data: response.data.filter((p) => !p.deleted).map(toCatalogProduct),
        })),
      );
  }

  /** Trae el estado actual de varios productos; un producto que no se puede leer llega como null. */
  getProducts(ids: string[]): Observable<(CatalogProduct | null)[]> {
    if (ids.length === 0) {
      return of([]);
    }
    return forkJoin(
      ids.map((id) =>
        this.api.get<ApiProduct>(`products/${encodeURIComponent(id)}`).pipe(
          map(toCatalogProduct),
          catchError(() => of(null)),
        ),
      ),
    );
  }
}

function toCatalogProduct(raw: ApiProduct): CatalogProduct {
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.sku,
    price: Number(raw.price),
    stock: Number(raw.stock),
    unit: raw.unit,
    active: (raw.active ?? true) && !raw.deleted,
  };
}
