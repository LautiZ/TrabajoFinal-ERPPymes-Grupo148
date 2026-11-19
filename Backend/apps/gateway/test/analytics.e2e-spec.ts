import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { of } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_SERVICE, ERP_PATTERNS, ERP_SERVICE } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/config/configure-app';

// TES-88: the financial reports are for Owner and Admin only. The full HTTP
// pipeline runs (guards, validation, prefix); Auth and the ERP are mocked.

const range = {
  from: '2026-11-01T00:00:00.000-03:00',
  to: '2026-11-30T23:59:59.999-03:00',
};

const routes = [
  ['/api/analytics/summary', range, ERP_PATTERNS.ANALYTICS_SUMMARY],
  [
    '/api/analytics/sales-over-time',
    { ...range, groupBy: 'week' },
    ERP_PATTERNS.ANALYTICS_SALES_OVER_TIME,
  ],
  [
    '/api/analytics/top-products',
    { ...range, limit: '5' },
    ERP_PATTERNS.ANALYTICS_TOP_PRODUCTS,
  ],
  [
    '/api/analytics/inventory-value',
    {},
    ERP_PATTERNS.ANALYTICS_INVENTORY_VALUE,
  ],
] as const;

describe('Analytics routes (e2e)', () => {
  let app: INestApplication<App>;
  const authClient = { send: jest.fn() };
  const erpClient = { send: jest.fn() };

  const as = (role: string) =>
    authClient.send.mockReturnValue(of({ userId: 'u-1', role, jti: 'j-1' }));

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_SERVICE)
      .useValue(authClient)
      .overrideProvider(ERP_SERVICE)
      .useValue(erpClient)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    authClient.send.mockReset();
    erpClient.send.mockReset();
    erpClient.send.mockReturnValue(of({ ok: true }));
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(routes)(
    '%s without token -> 401, the ERP is not called',
    async (path, query) => {
      await request(app.getHttpServer()).get(path).query(query).expect(401);
      expect(erpClient.send).not.toHaveBeenCalled();
    },
  );

  it.each(routes)('%s as Employee -> 403', async (path, query) => {
    as('Employee');
    await request(app.getHttpServer())
      .get(path)
      .query(query)
      .set('Authorization', 'Bearer tkn')
      .expect(403);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it.each(
    routes.flatMap(([path, query, pattern]) =>
      (['Owner', 'Admin'] as const).map(
        (role) => [path, role, query, pattern] as const,
      ),
    ),
  )('%s as %s -> 200', async (path, role, query, pattern) => {
    as(role);
    await request(app.getHttpServer())
      .get(path)
      .query(query)
      .set('Authorization', 'Bearer tkn')
      .expect(200, { ok: true });
    expect(erpClient.send).toHaveBeenCalledWith(pattern, expect.any(Object));
  });

  it('converts and validates the query before reaching the ERP', async () => {
    as('Owner');
    await request(app.getHttpServer())
      .get('/api/analytics/top-products')
      .query({ ...range, limit: '5' })
      .set('Authorization', 'Bearer tkn')
      .expect(200);
    // limit arrives as a number; groupBy gets its default elsewhere
    expect(erpClient.send).toHaveBeenCalledWith(
      ERP_PATTERNS.ANALYTICS_TOP_PRODUCTS,
      {
        ...range,
        limit: 5,
      },
    );
  });

  it.each([
    ['a date without time and offset', { from: '2026-11-01', to: range.to }],
    ['an unknown groupBy', { ...range, groupBy: 'year' }],
    ['an extra query param', { ...range, hack: '1' }],
  ])('rejects %s with 400 before reaching the ERP', async (_case, query) => {
    as('Owner');
    await request(app.getHttpServer())
      .get('/api/analytics/sales-over-time')
      .query(query)
      .set('Authorization', 'Bearer tkn')
      .expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });
});
