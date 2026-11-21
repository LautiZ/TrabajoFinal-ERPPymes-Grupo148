import { StockMovement, movementReason } from './stock-movement.model';

const movement = (overrides: Partial<StockMovement>): StockMovement => ({
  id: 'm-1',
  type: 'Income',
  direction: 'In',
  quantity: 1,
  reason: null,
  saleNumber: null,
  product: { id: 'p-1', name: 'Yerba', sku: 'YER-1' },
  createdAt: '',
  ...overrides,
});

describe('movementReason', () => {
  it('uses the reason of a manual adjustment', () => {
    expect(movementReason(movement({ type: 'Adjustment', reason: 'Recuento' }))).toBe('Recuento');
  });

  it('names the sale of an outcome', () => {
    expect(movementReason(movement({ type: 'Outcome', saleNumber: 12 }))).toBe('Venta #12');
  });

  it('names the cancelled sale of a reversal', () => {
    expect(movementReason(movement({ type: 'Income', saleNumber: 12 }))).toBe(
      'Cancelación de venta #12',
    );
  });

  it('treats an income without sale as initial stock', () => {
    expect(movementReason(movement({ type: 'Income' }))).toBe('Stock inicial');
  });
});
