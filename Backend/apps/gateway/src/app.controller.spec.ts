import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const appService = { checkServices: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return the status when every service is up', async () => {
      const health = { auth: 'up', erp: 'up', payments: 'up' };
      appService.checkServices.mockResolvedValue(health);

      await expect(appController.health()).resolves.toEqual(health);
    });

    it('should throw 503 when any service is down', async () => {
      appService.checkServices.mockResolvedValue({
        auth: 'up',
        erp: 'down',
        payments: 'up',
      });

      await expect(appController.health()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
