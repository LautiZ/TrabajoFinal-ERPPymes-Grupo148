import { Category, Product } from '../models/product.model';

export function createCategory(overrides: Partial<Category> = {}): Category {
  return { id: 'c1', name: 'Almacén', ...overrides };
}

export function createProduct(overrides: Partial<Product> = {}): Product {
  const category = overrides.category === undefined ? createCategory() : overrides.category;
  return {
    id: 'p1',
    name: 'Yerba Mate 1kg',
    sku: 'YER-001',
    price: 4500,
    stock: 25,
    unit: 'Unit',
    categoryId: category?.id ?? 'c1',
    category,
    active: true,
    deleted: false,
    ...overrides,
  };
}
