import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;
  const appService = { checkServices: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue(appService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 when every service is up', () => {
    const health = { auth: 'up', erp: 'up', payments: 'up' };
    appService.checkServices.mockResolvedValue(health);

    return request(app.getHttpServer()).get('/health').expect(200, health);
  });

  it('GET /health returns 503 when a service is down', () => {
    const health = { auth: 'up', erp: 'down', payments: 'up' };
    appService.checkServices.mockResolvedValue(health);

    return request(app.getHttpServer()).get('/health').expect(503, health);
  });
});
