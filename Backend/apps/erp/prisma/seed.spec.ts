import { MovementType, ProductUnit } from '../src/generated/prisma/client';
import { CatalogSeed, ErpSeedClient, seedErp } from './seed';

describe('seedErp', () => {
  const ownerId = 'owner-id';

  const catalog: CatalogSeed = [
    {
      name: 'Almacen',
      products: [
        {
          name: 'Arroz 1 kg',
          sku: 'TST-001',
          price: 1000,
          unit: ProductUnit.Unit,
          stock: 40,
        },
        {
          name: 'Sin stock',
          sku: 'TST-002',
          price: 500,
          unit: ProductUnit.Unit,
          stock: 0,
        },
      ],
    },
  ];

  function mockClient(
    opts: { existingCategory?: { id: string }; existingSkus?: string[] } = {},
  ) {
    const category = {
      findFirst: jest.fn().mockResolvedValue(opts.existingCategory ?? null),
      create: jest.fn().mockResolvedValue({ id: 'new-category-id' }),
    };
    const product = {
      findUnique: jest.fn(({ where }) =>
        Promise.resolve(
          opts.existingSkus?.includes(where.sku) ? { id: 'p' } : null,
        ),
      ),
      create: jest.fn().mockResolvedValue({ id: 'new-product-id' }),
    };
    return {
      client: { category, product } as unknown as ErpSeedClient,
      category,
      product,
    };
  }

  it('creates each product with an Income movement that backs its stock (RN-01)', async () => {
    const { client, product } = mockClient();

    await seedErp(client, ownerId, catalog);

    const { data } = product.create.mock.calls[0][0];
    expect(data.stock).toBe(40);
    expect(data.stockMovements.create).toEqual({
      typeMovement: MovementType.Income,
      quantity: 40,
      userId: ownerId,
    });
  });

  it('creates a product without stock and without movements', async () => {
    const { client, product } = mockClient();

    await seedErp(client, ownerId, catalog);

    const { data } = product.create.mock.calls[1][0];
    expect(data.stock).toBe(0);
    expect(data.stockMovements).toBeUndefined();
  });

  it('skips products that already exist, so stock is never doubled', async () => {
    const { client, product } = mockClient({ existingSkus: ['TST-001'] });

    await seedErp(client, ownerId, catalog);

    expect(product.create).toHaveBeenCalledTimes(1);
    expect(product.create.mock.calls[0][0].data.sku).toBe('TST-002');
  });

  it('reuses an existing active category instead of creating it again', async () => {
    const { client, category, product } = mockClient({
      existingCategory: { id: 'cat-1' },
    });

    await seedErp(client, ownerId, catalog);

    expect(category.create).not.toHaveBeenCalled();
    expect(product.create.mock.calls[0][0].data.categoryId).toBe('cat-1');
  });
});
