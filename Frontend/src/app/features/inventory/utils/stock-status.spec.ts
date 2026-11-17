import { DEFAULT_LOW_STOCK_THRESHOLD, getStockStatus } from './stock-status';

describe('getStockStatus', () => {
  it('sin stock cuando es 0 o negativo', () => {
    expect(getStockStatus(0)).toBe('out');
    expect(getStockStatus(-3)).toBe('out');
  });

  it('stock bajo cuando está en el umbral o por debajo (y mayor a 0)', () => {
    expect(getStockStatus(1)).toBe('low');
    expect(getStockStatus(DEFAULT_LOW_STOCK_THRESHOLD)).toBe('low');
  });

  it('stock normal por encima del umbral', () => {
    expect(getStockStatus(DEFAULT_LOW_STOCK_THRESHOLD + 1)).toBe('ok');
    expect(getStockStatus(500)).toBe('ok');
  });

  it('respeta un umbral configurable', () => {
    expect(getStockStatus(30, 30)).toBe('low');
    expect(getStockStatus(31, 30)).toBe('ok');
    expect(getStockStatus(5, 2)).toBe('ok');
  });

  it('admite cantidades decimales', () => {
    expect(getStockStatus(0.5)).toBe('low');
    expect(getStockStatus(10.001)).toBe('ok');
  });
});
