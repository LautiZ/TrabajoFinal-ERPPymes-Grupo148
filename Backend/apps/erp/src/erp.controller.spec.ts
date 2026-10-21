import { Test, TestingModule } from '@nestjs/testing';
import { ErpController } from './erp.controller';
import { ErpService } from './erp.service';

describe('ErpController', () => {
  let erpController: ErpController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [ErpController],
      providers: [ErpService],
    }).compile();

    erpController = app.get<ErpController>(ErpController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(erpController.getHello()).toBe('Hello World!');
    });
  });
});
