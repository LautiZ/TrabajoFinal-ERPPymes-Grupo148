import { ParamMap, Params } from '@angular/router';
import { ProductListQuery, ProductSortField, StockStatusFilter } from '../models/product.model';

export const PAGE_SIZE_OPTIONS = [5, 10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

const SORT_FIELDS: readonly ProductSortField[] = ['name', 'sku', 'category', 'price', 'stock'];
const STOCK_FILTERS: readonly StockStatusFilter[] = ['low', 'out'];

/** Estado de la vista de la tabla; se refleja en los query params de la URL. */
export interface ListState {
  page: number;
  limit: number;
  search: string;
  sortBy: ProductSortField;
  sortOrder: 'asc' | 'desc';
  categoryId: string;
  stockStatus: StockStatusFilter | '';
}

export const DEFAULT_LIST_STATE: ListState = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  search: '',
  sortBy: 'name',
  sortOrder: 'asc',
  categoryId: '',
  stockStatus: '',
};

function positiveInt(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** Lee el estado desde la URL; cualquier valor inválido vuelve al valor por defecto. */
export function parseListState(params: ParamMap): ListState {
  const sortBy = params.get('sortBy') as ProductSortField | null;
  const stockStatus = params.get('stockStatus') as StockStatusFilter | null;
  const limit = positiveInt(params.get('limit'), DEFAULT_PAGE_SIZE);

  return {
    page: positiveInt(params.get('page'), 1),
    limit: (PAGE_SIZE_OPTIONS as readonly number[]).includes(limit) ? limit : DEFAULT_PAGE_SIZE,
    search: (params.get('search') ?? '').trim(),
    sortBy: sortBy && SORT_FIELDS.includes(sortBy) ? sortBy : DEFAULT_LIST_STATE.sortBy,
    sortOrder: params.get('sortOrder') === 'desc' ? 'desc' : 'asc',
    categoryId: params.get('categoryId') ?? '',
    stockStatus: stockStatus && STOCK_FILTERS.includes(stockStatus) ? stockStatus : '',
  };
}

/** Convierte el estado en query params; los valores por defecto se omiten (`null`) para una URL limpia. */
export function toQueryParams(state: ListState): Params {
  const d = DEFAULT_LIST_STATE;
  return {
    page: state.page === d.page ? null : state.page,
    limit: state.limit === d.limit ? null : state.limit,
    search: state.search || null,
    sortBy: state.sortBy === d.sortBy ? null : state.sortBy,
    sortOrder: state.sortOrder === d.sortOrder ? null : state.sortOrder,
    categoryId: state.categoryId || null,
    stockStatus: state.stockStatus || null,
  };
}

/** Estado de la vista -> consulta al backend. */
export function toListQuery(state: ListState, lowStockThreshold?: number): ProductListQuery {
  return {
    page: state.page,
    limit: state.limit,
    search: state.search || undefined,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    categoryId: state.categoryId || undefined,
    stockStatus: state.stockStatus || undefined,
    lowStockThreshold: state.stockStatus === 'low' ? lowStockThreshold : undefined,
  };
}

export function hasActiveFilters(state: ListState): boolean {
  return state.search !== '' || state.categoryId !== '' || state.stockStatus !== '';
}
