import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import type { CreateProductDto, ProductView } from '@app/contracts';
import { CategoriesRepository } from '../categories/categories.repository';
import { ProductsRepository } from './products.repository';
import { ProductsService } from './products.service';

const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return ((err as RpcException).getError() as { status: number }).status;
  }
  throw new Error('expected the promise to reject');
};

const userId = 'user-1';

const product = (overrides: Partial<ProductView> = {}): ProductView => ({
  id: 'prod-1',
  name: 'Yerba 1kg',
  sku: 'YER-001',
  price: 3500,
  stock: 10,
  lowStockThreshold: 2,
  unit: 'Unit',
  categoryId: 'cat-1',
  category: { id: 'cat-1', name: 'Almacen' },
  active: true,
  deleted: false,
  createdAt: new Date('2026-11-17T00:00:00Z'),
  updatedAt: new Date('2026-11-17T00:00:00Z'),
  ...overrides,
});

const newProduct = (
  overrides: Partial<CreateProductDto> = {},
): CreateProductDto => ({
  name: 'Yerba 1kg',
  sku: 'YER-001',
  price: 3500,
  stock: 10,
  unit: 'Unit',
  categoryId: 'cat-1',
  ...overrides,
});

describe('ProductsService', () => {
  let service: ProductsService;
  const products = {
    list: jest.fn(),
    stockSummary: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    adjustStock: jest.fn(),
  };
  const categories = { existsActive: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    categories.existsActive.mockResolvedValue(true);

    const module = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: ProductsRepository, useValue: products },
        { provide: CategoriesRepository, useValue: categories },
      ],
    }).compile();
    service = module.get(ProductsService);
  });

  describe('list', () => {
    it('wraps the rows in the paginated shape the front expects', async () => {
      products.list.mockResolvedValue([[product()], 21]);

      const result = await service.list({
        page: 2,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result.meta).toEqual({
        total: 21,
        page: 2,
        limit: 10,
        totalPages: 3,
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('answers 404 for a missing or deleted product', async () => {
      products.findById.mockResolvedValue(null);
      expect(await statusOf(service.get('prod-x'))).toBe(404);
    });
  });

  describe('create', () => {
    it('creates the product with the user that loads the initial stock', async () => {
      products.create.mockResolvedValue(product());

      await service.create({ userId, product: newProduct() });

      expect(products.create).toHaveBeenCalledWith(newProduct(), userId);
    });

    it('rejects decimal stock on a Unit product (RN-05)', async () => {
      const status = await statusOf(
        service.create({ userId, product: newProduct({ stock: 1.5 }) }),
      );
      expect(status).toBe(400);
      expect(products.create).not.toHaveBeenCalled();
    });

    it('accepts decimal stock on a Kg product (RN-05)', async () => {
      products.create.mockResolvedValue(product({ unit: 'Kg', stock: 1.5 }));
      await service.create({
        userId,
        product: newProduct({ unit: 'Kg', stock: 1.5 }),
      });
      expect(products.create).toHaveBeenCalled();
    });

    it('rejects a decimal threshold on a Unit product (RN-05)', async () => {
      const status = await statusOf(
        service.create({
          userId,
          product: newProduct({ lowStockThreshold: 0.5 }),
        }),
      );
      expect(status).toBe(400);
    });

    it('answers 400 when the category does not exist or is deleted', async () => {
      categories.existsActive.mockResolvedValue(false);
      expect(
        await statusOf(service.create({ userId, product: newProduct() })),
      ).toBe(400);
      expect(products.create).not.toHaveBeenCalled();
    });

    it('answers 409 when the SKU is taken', async () => {
      products.create.mockResolvedValue(null);
      expect(
        await statusOf(service.create({ userId, product: newProduct() })),
      ).toBe(409);
    });
  });

  describe('update', () => {
    it('answers 404 for a missing product before touching it', async () => {
      products.findById.mockResolvedValue(null);
      expect(
        await statusOf(
          service.update({ id: 'prod-x', product: { name: 'X' } }),
        ),
      ).toBe(404);
      expect(products.update).not.toHaveBeenCalled();
    });

    it('rejects switching to Unit while the stock is fractional (RN-05)', async () => {
      products.findById.mockResolvedValue(product({ unit: 'Kg', stock: 2.5 }));
      expect(
        await statusOf(
          service.update({ id: 'prod-1', product: { unit: 'Unit' } }),
        ),
      ).toBe(400);
    });

    it('only checks the category when it changes', async () => {
      products.findById.mockResolvedValue(product());
      products.update.mockResolvedValue(product());

      await service.update({ id: 'prod-1', product: { categoryId: 'cat-1' } });
      expect(categories.existsActive).not.toHaveBeenCalled();

      await service.update({ id: 'prod-1', product: { categoryId: 'cat-2' } });
      expect(categories.existsActive).toHaveBeenCalledWith('cat-2');
    });

    it('answers 409 when the new SKU is taken', async () => {
      products.findById.mockResolvedValue(product());
      products.update.mockResolvedValue(null);
      expect(
        await statusOf(
          service.update({ id: 'prod-1', product: { sku: 'DUP' } }),
        ),
      ).toBe(409);
    });
  });

  describe('remove', () => {
    it('answers 404 when nothing was deleted', async () => {
      products.softDelete.mockResolvedValue(false);
      expect(await statusOf(service.remove('prod-x'))).toBe(404);
    });
  });

  describe('adjustStock', () => {
    const adjust = (type: 'Income' | 'Outcome', quantity: number) =>
      service.adjustStock({
        id: 'prod-1',
        userId,
        adjustment: { type, quantity, reason: 'Recount' },
      });

    beforeEach(() => products.findById.mockResolvedValue(product()));

    it('stores an Income as a positive Adjustment', async () => {
      products.adjustStock.mockResolvedValue(product({ stock: 15 }));
      await adjust('Income', 5);
      expect(products.adjustStock).toHaveBeenCalledWith(
        'prod-1',
        5,
        'Recount',
        userId,
      );
    });

    it('stores an Outcome as a negative Adjustment (RN-03)', async () => {
      products.adjustStock.mockResolvedValue(product({ stock: 7 }));
      await adjust('Outcome', 3);
      expect(products.adjustStock).toHaveBeenCalledWith(
        'prod-1',
        -3,
        'Recount',
        userId,
      );
    });

    it('rejects a decimal quantity on a Unit product (RN-05)', async () => {
      expect(await statusOf(adjust('Income', 0.5))).toBe(400);
      expect(products.adjustStock).not.toHaveBeenCalled();
    });

    it('answers 409 when the stock is not enough (RN-02)', async () => {
      products.adjustStock.mockResolvedValue(null);
      expect(await statusOf(adjust('Outcome', 50))).toBe(409);
    });

    it('answers 404 when the product was deleted in between', async () => {
      products.adjustStock.mockResolvedValue(null);
      products.findById
        .mockResolvedValueOnce(product())
        .mockResolvedValueOnce(null);
      expect(await statusOf(adjust('Outcome', 1))).toBe(404);
    });
  });
});
