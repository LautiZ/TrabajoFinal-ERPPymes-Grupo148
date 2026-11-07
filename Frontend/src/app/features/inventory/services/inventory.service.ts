import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import { ApiService } from '../../../core/services/api.service';
import {
  AdjustStockDto,
  Category,
  CreateProductDto,
  Product,
  ProductListQuery,
  ProductUnit,
  UpdateProductDto,
} from '../models/product.model';

/** Forma cruda del ERP MS: los decimales de PostgreSQL pueden llegar como string. */
interface ApiProduct {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  stock: number | string;
  unit: ProductUnit;
  categoryId?: string;
  category?: Category | null;
  active?: boolean;
  deleted?: boolean;
}

/** Acceso al CRUD de productos, categorías y movimientos de stock del ERP MS (vía API Gateway). */
@Injectable({
  providedIn: 'root',
})
export class InventoryService {
  private readonly api = inject(ApiService);
  private readonly productsPath = 'products';

  list(query: ProductListQuery = {}): Observable<PaginatedResponse<Product>> {
    return this.api
      .get<PaginatedResponse<ApiProduct>>(this.productsPath, {
        page: query.page ?? 1,
        limit: query.limit ?? 10,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        categoryId: query.categoryId,
        stockStatus: query.stockStatus,
        lowStockThreshold: query.lowStockThreshold,
      })
      .pipe(map((response) => ({ ...response, data: response.data.map(toProduct) })));
  }

  getById(id: string): Observable<Product> {
    return this.api.get<ApiProduct>(this.productPath(id)).pipe(map(toProduct));
  }

  create(dto: CreateProductDto): Observable<Product> {
    return this.api.post<ApiProduct>(this.productsPath, dto).pipe(map(toProduct));
  }

  update(id: string, dto: UpdateProductDto): Observable<Product> {
    return this.api.patch<ApiProduct>(this.productPath(id), dto).pipe(map(toProduct));
  }

  /** Baja lógica del producto. */
  delete(id: string): Observable<void> {
    return this.api.delete<void>(this.productPath(id));
  }

  /**
   * Registra un movimiento manual de stock (ingreso o egreso con motivo). El backend es
   * quien rechaza dejar el stock en negativo (RN-02); la respuesta no se usa: quien llama
   * vuelve a consultar el producto o la tabla.
   */
  adjustStock(id: string, dto: AdjustStockDto): Observable<void> {
    return this.api
      .post<unknown>(`${this.productPath(id)}/stock-movements`, dto)
      .pipe(map(() => undefined));
  }

  /** Acepta tanto un arreglo simple como una respuesta paginada. */
  listCategories(): Observable<Category[]> {
    return this.api
      .get<Category[] | PaginatedResponse<Category>>('categories')
      .pipe(map((response) => (Array.isArray(response) ? response : response.data)));
  }

  private productPath(id: string): string {
    return `${this.productsPath}/${encodeURIComponent(id)}`;
  }
}

function toProduct(raw: ApiProduct): Product {
  return {
    id: raw.id,
    name: raw.name,
    sku: raw.sku,
    price: Number(raw.price),
    stock: Number(raw.stock),
    unit: raw.unit,
    categoryId: raw.categoryId ?? raw.category?.id ?? '',
    category: raw.category ?? null,
    active: raw.active ?? true,
    deleted: raw.deleted ?? false,
  };
}
