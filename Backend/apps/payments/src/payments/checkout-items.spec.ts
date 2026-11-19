import type { SaleItemView, SaleView } from '@app/contracts';
import { toCheckoutItems } from './checkout-items';

const item = (overrides: Partial<SaleItemView>): SaleItemView => ({
  productId: 'p-1',
  name: 'Yerba',
  sku: 'YER-1',
  quantity: 1,
  unitPrice: 100,
  subtotal: 100,
  ...overrides,
});

const sale = (items: SaleItemView[], total: number) =>
  ({ id: 'sale-1', saleNumber: 42, total, items }) as SaleView;

describe('toCheckoutItems', () => {
  it('sends whole quantities with their unit price', () => {
    const items = toCheckoutItems(
      sale([item({ quantity: 2, unitPrice: 1500.5, subtotal: 3001 })], 3001),
    );

    expect(items).toEqual([
      { code: 'YER-1', title: 'Yerba', quantity: 2, unitPrice: 1500.5 },
    ]);
  });

  it('sends a weighed product as one line priced at its subtotal', () => {
    const items = toCheckoutItems(
      sale(
        [
          item({
            productId: 'p-2',
            name: 'Queso',
            sku: 'QUE-1',
            quantity: 1.25,
            unitPrice: 8000,
            subtotal: 10000,
          }),
        ],
        10000,
      ),
    );

    expect(items).toEqual([
      { code: 'QUE-1', title: 'Queso x 1.25', quantity: 1, unitPrice: 10000 },
    ]);
  });

  it('falls back to a single line when the items do not add up to the total', () => {
    // 3 x 33.33 = 99.99, but the sale was stored with total 100
    const items = toCheckoutItems(
      sale([item({ quantity: 3, unitPrice: 33.33, subtotal: 100 })], 100),
    );

    expect(items).toEqual([
      { code: 'VENTA-42', title: 'Venta #42', quantity: 1, unitPrice: 100 },
    ]);
  });
});
