import { HttpErrorResponse } from '@angular/common/http';
import { parseStockConflicts } from './stock-conflict';

const httpError = (status: number, body: unknown): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: body });

describe('parseStockConflicts', () => {
  it('devuelve null si no es un HttpErrorResponse', () => {
    expect(parseStockConflicts(new Error('x'))).toBeNull();
    expect(parseStockConflicts(null)).toBeNull();
  });

  it('devuelve null para estados que no son de conflicto', () => {
    expect(parseStockConflicts(httpError(500, { code: 'INSUFFICIENT_STOCK' }))).toBeNull();
    expect(parseStockConflicts(httpError(400, { items: [] }))).toBeNull();
  });

  it('devuelve null si el conflicto no es de stock', () => {
    expect(parseStockConflicts(httpError(409, { code: 'DUPLICATE_SKU' }))).toBeNull();
    expect(parseStockConflicts(httpError(409, null))).toBeNull();
  });

  it('extrae los ítems con lo pedido y lo disponible', () => {
    const error = httpError(409, {
      code: 'INSUFFICIENT_STOCK',
      items: [
        { productId: 'p1', name: 'Yerba', requested: 5, available: 2 },
        { productId: 'p2', requested: '3', available: '0' },
      ],
    });

    expect(parseStockConflicts(error)).toEqual([
      { productId: 'p1', name: 'Yerba', requested: 5, available: 2 },
      { productId: 'p2', name: '', requested: 3, available: 0 },
    ]);
  });

  it('acepta snake_case, details y errores anidados', () => {
    expect(
      parseStockConflicts(
        httpError(422, { details: [{ product_id: 'p1', quantity: 4, stock: 1 }] }),
      ),
    ).toEqual([{ productId: 'p1', name: '', requested: 4, available: 1 }]);

    expect(
      parseStockConflicts(
        httpError(409, { error: { items: [{ productId: 'p1', requested: 2, available: 1 }] } }),
      ),
    ).toEqual([{ productId: 'p1', name: '', requested: 2, available: 1 }]);
  });

  it('descarta ítems malformados', () => {
    const error = httpError(409, {
      code: 'INSUFFICIENT_STOCK',
      items: [{ requested: 1 }, { productId: 'p1' }, 'texto', { productId: 'p2', available: 1 }],
    });

    expect(parseStockConflicts(error)).toEqual([
      { productId: 'p2', name: '', requested: 0, available: 1 },
    ]);
  });

  it('devuelve lista vacía si el backend indica stock insuficiente sin detalle', () => {
    expect(parseStockConflicts(httpError(409, { code: 'INSUFFICIENT_STOCK' }))).toEqual([]);
  });
});
