import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { PaginatedResponse } from '../../../core/models/pagination.model';
import { Product, ProductListQuery } from '../models/product.model';
import { InventoryService } from './inventory.service';
import { StockCounts, StockSummaryService } from './stock-summary.service';

function totalOnly(total: number): PaginatedResponse<Product> {
  return { data: [], meta: { total, page: 1, limit: 1, totalPages: total } };
}

describe('StockSummaryService', () => {
  let inventory: { list: Mock };
  let service: StockSummaryService;

  beforeEach(() => {
    inventory = {
      list: vi.fn((query: ProductListQuery) => {
        if (query.stockStatus === 'low') return of(totalOnly(4));
        if (query.stockStatus === 'out') return of(totalOnly(2));
        return of(totalOnly(20));
      }),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: InventoryService, useValue: inventory }],
    });
    service = TestBed.inject(StockSummaryService);
  });

  it('cuenta los productos en cada estado a partir del total de la paginación', () => {
    let summary: StockCounts | undefined;
    service.load(10).subscribe((s) => (summary = s));

    expect(summary).toEqual({ total: 20, low: 4, out: 2, ok: 14 });
  });

  it('consulta de a una fila y con el umbral recibido', () => {
    service.load(15).subscribe();

    expect(inventory.list).toHaveBeenCalledTimes(3);
    expect(inventory.list).toHaveBeenCalledWith({ page: 1, limit: 1 });
    expect(inventory.list).toHaveBeenCalledWith({
      stockStatus: 'low',
      lowStockThreshold: 15,
      page: 1,
      limit: 1,
    });
    expect(inventory.list).toHaveBeenCalledWith({ stockStatus: 'out', page: 1, limit: 1 });
  });

  it('nunca informa un "stock normal" negativo', () => {
    inventory.list.mockImplementation((query: ProductListQuery) =>
      of(totalOnly(query.stockStatus ? 15 : 10)),
    );
    let summary: StockCounts | undefined;

    service.load(10).subscribe((s) => (summary = s));

    expect(summary?.ok).toBe(0);
  });

  it('propaga el error si falla alguna consulta', () => {
    inventory.list.mockReturnValue(throwError(() => new Error('down')));
    let failed = false;

    service.load(10).subscribe({ error: () => (failed = true) });

    expect(failed).toBe(true);
  });
});
