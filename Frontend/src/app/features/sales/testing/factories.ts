import { CatalogProduct } from '../models/product.model';

export function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

export function createProduct(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    id: 'p1',
    name: 'Yerba 1kg',
    sku: 'YER-001',
    price: 1500,
    stock: 10,
    unit: 'Unit',
    active: true,
    ...overrides,
  };
}
