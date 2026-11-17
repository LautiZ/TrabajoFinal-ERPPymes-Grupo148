import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

describe('CategoriesService', () => {
  let service: CategoriesService;
  const categories = { list: jest.fn(), create: jest.fn() };

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
