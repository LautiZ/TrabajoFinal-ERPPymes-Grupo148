import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const categories = {
    list: jest.fn(),
    create: jest.fn(),
    existsActive: jest.fn(),
    countActiveProducts: jest.fn(),
    softDelete: jest.fn(),
  };

  const statusOf = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (err) {
      return ((err as RpcException).getError() as { status: number }).status;
    }
    throw new Error('expected the promise to reject');
  };

  describe('remove', () => {
    beforeEach(() => {
      categories.existsActive.mockResolvedValue(true);
      categories.countActiveProducts.mockResolvedValue(0);
      categories.softDelete.mockResolvedValue(true);
    });

    it('soft-deletes a category without active products', async () => {
      await service.remove('cat-1');
      expect(categories.softDelete).toHaveBeenCalledWith('cat-1');
    });

    it('answers 404 for a missing or already deleted category', async () => {
      categories.existsActive.mockResolvedValue(false);
      expect(await statusOf(service.remove('cat-x'))).toBe(404);
      expect(categories.softDelete).not.toHaveBeenCalled();
    });

    it('answers 409 while active products use it', async () => {
      categories.countActiveProducts.mockResolvedValue(3);
      expect(await statusOf(service.remove('cat-1'))).toBe(409);
      expect(categories.softDelete).not.toHaveBeenCalled();
    });

    it('answers 404 when it was deleted in between', async () => {
      categories.softDelete.mockResolvedValue(false);
      expect(await statusOf(service.remove('cat-1'))).toBe(404);
    });
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CategoriesService,
        { provide: CategoriesRepository, useValue: categories },
      ],
    }).compile();
    service = module.get(CategoriesService);
  });

  it('returns the created category', async () => {
    const created = { id: 'cat-1', name: 'Bebidas', description: null };
    categories.create.mockResolvedValue(created);
    expect(await service.create({ name: 'Bebidas' })).toEqual(created);
  });

  it('answers 409 when an active category has that name', async () => {
    categories.create.mockResolvedValue(null);
    await expect(service.create({ name: 'Bebidas' })).rejects.toBeInstanceOf(
      RpcException,
    );
    await expect(service.create({ name: 'Bebidas' })).rejects.toMatchObject({
      error: { status: 409 },
    });
  });
});
