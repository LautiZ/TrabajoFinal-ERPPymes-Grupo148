import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_SERVICE, ERP_SERVICE, PAYMENTS_SERVICE } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';
import { configureApp } from './../src/config/configure-app';
import { envs } from './../src/config/envs';

// TES-80: CORS only opens for the origins listed in CORS_ORIGINS
describe('Gateway CORS (e2e)', () => {
  let app: INestApplication<App>;
  const allowed = envs.CORS_ORIGINS[0];
  const foreign = 'https://evil.example.com';

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue({ checkServices: jest.fn() })
      .overrideProvider(AUTH_SERVICE)
      .useValue({ send: jest.fn() })
      .overrideProvider(ERP_SERVICE)
      .useValue({ send: jest.fn() })
      .overrideProvider(PAYMENTS_SERVICE)
      .useValue({ send: jest.fn() })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const preflight = (origin: string) =>
    request(app.getHttpServer())
      .options('/api/products')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization');

  it('answers the preflight of an allowed origin without needing a token', async () => {
    const res = await preflight(allowed).expect(204);
    expect(res.headers['access-control-allow-origin']).toBe(allowed);
    expect(res.headers['access-control-allow-methods']).toContain('GET');
    expect(res.headers['access-control-allow-headers']).toMatch(
      /authorization/i,
    );
  });

  it('does not grant CORS headers to an origin outside the list', async () => {
    const res = await preflight(foreign);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('adds the allow-origin header to a real response for an allowed origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('Origin', allowed)
      .expect(401);
    expect(res.headers['access-control-allow-origin']).toBe(allowed);
  });

  it('does not add the allow-origin header for an origin outside the list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('Origin', foreign)
      .expect(401);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
