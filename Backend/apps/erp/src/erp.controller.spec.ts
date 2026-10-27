import { Test, TestingModule } from '@nestjs/testing';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';
import { ProductsRepository } from './products/products.repository';

describe('ErpController', () => {
  let erpController: ErpController;
  let productsRepository: ProductsRepository;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ErpController],
      providers: [
        ErpService,
        { provide: ProductsRepository, useValue: { count: jest.fn() } },
      ],
    }).compile();

    erpController = app.get<ErpController>(ErpController);
    productsRepository = app.get<ProductsRepository>(ProductsRepository);
  });

  describe('countProducts', () => {
    it('should return the count of products', async () => {
      jest.spyOn(productsRepository, 'count').mockResolvedValue(5);
      expect(await erpController.countProducts()).toBe(5);
    });
  });
});
