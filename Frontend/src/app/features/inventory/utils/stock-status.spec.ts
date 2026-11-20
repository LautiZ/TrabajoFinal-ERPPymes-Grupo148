import { getStockStatus } from './stock-status';

describe('getStockStatus', () => {
  it('sin stock cuando es 0 o negativo', () => {
    expect(getStockStatus(0, 5)).toBe('out');
    expect(getStockStatus(-3)).toBe('out');
  });

  it('stock bajo cuando está en el mínimo del producto o por debajo (y mayor a 0)', () => {
    expect(getStockStatus(1, 10)).toBe('low');
    expect(getStockStatus(10, 10)).toBe('low');
  });

  it('stock normal por encima del mínimo', () => {
    expect(getStockStatus(11, 10)).toBe('ok');
    expect(getStockStatus(500, 10)).toBe('ok');
  });

  it('un mínimo de 0 significa sin alerta', () => {
    expect(getStockStatus(1, 0)).toBe('ok');
    expect(getStockStatus(1)).toBe('ok');
  });

  it('admite cantidades decimales', () => {
    expect(getStockStatus(0.5, 0.5)).toBe('low');
    expect(getStockStatus(10.001, 10)).toBe('ok');
  });
});
