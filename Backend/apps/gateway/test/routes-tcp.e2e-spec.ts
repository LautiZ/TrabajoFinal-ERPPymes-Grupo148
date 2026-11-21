import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EMPTY, of } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  AUTH_PATTERNS,
  AUTH_SERVICE,
  ERP_PATTERNS,
  ERP_SERVICE,
  PAYMENTS_PATTERNS,
  PAYMENTS_SERVICE,
} from '@app/contracts';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/config/configure-app';

// TES-80: every HTTP route sends the expected TCP pattern to the right
// service, and to no other one. The three TCP clients are mocked.

const id = '3f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b';
const owner = { userId: 'u-1', role: 'Owner', jti: 'j-1' };

type Target = 'auth' | 'erp' | 'payments';
type Method = 'get' | 'post' | 'patch' | 'delete';
type Route = {
  method: Method;
  path: string;
  target: Target;
  pattern: string;
  body?: object;
  status: number;
  public?: boolean;
};

const routes: Route[] = [
  // Auth MS
  {
    method: 'post',
    path: '/api/auth/login',
    target: 'auth',
    pattern: AUTH_PATTERNS.LOGIN,
    body: { email: 'ana@pyme.test', password: 'secret' },
    status: 200,
    public: true,
  },
  {
    method: 'post',
    path: '/api/auth/logout',
    target: 'auth',
    pattern: AUTH_PATTERNS.LOGOUT,
    status: 204,
  },
  {
    method: 'post',
    path: '/api/users',
    target: 'auth',
    pattern: AUTH_PATTERNS.CREATE_USER,
    body: {
      email: 'emp@pyme.test',
      password: '12345678',
      name: 'Emp',
      role: 'Employee',
    },
    status: 201,
  },
  // ERP MS: products
  {
    method: 'get',
    path: '/api/products',
    target: 'erp',
    pattern: ERP_PATTERNS.LIST_PRODUCTS,
    status: 200,
  },
  {
    method: 'get',
    path: '/api/products/stock-summary',
    target: 'erp',
    pattern: ERP_PATTERNS.STOCK_SUMMARY,
    status: 200,
  },
  {
    method: 'get',
    path: `/api/products/${id}`,
    target: 'erp',
    pattern: ERP_PATTERNS.GET_PRODUCT,
    status: 200,
  },
  {
    method: 'post',
    path: '/api/products',
    target: 'erp',
    pattern: ERP_PATTERNS.CREATE_PRODUCT,
    body: {
      name: 'Yerba 1kg',
      sku: 'YER-001',
      price: 3500,
      stock: 10,
      unit: 'Unit',
      categoryId: id,
    },
    status: 201,
  },
  {
    method: 'patch',
    path: `/api/products/${id}`,
    target: 'erp',
    pattern: ERP_PATTERNS.UPDATE_PRODUCT,
    body: { name: 'Yerba 500g' },
    status: 200,
  },
  {
    method: 'delete',
    path: `/api/products/${id}`,
    target: 'erp',
    pattern: ERP_PATTERNS.DELETE_PRODUCT,
    status: 204,
  },
  {
    method: 'post',
    path: `/api/products/${id}/stock-movements`,
    target: 'erp',
    pattern: ERP_PATTERNS.ADJUST_STOCK,
    body: { type: 'Outcome', quantity: 5, reason: 'Broken' },
    status: 201,
  },
  // ERP MS: categories
  {
    method: 'get',
    path: '/api/categories',
    target: 'erp',
    pattern: ERP_PATTERNS.LIST_CATEGORIES,
    status: 200,
  },
  {
    method: 'post',
    path: '/api/categories',
    target: 'erp',
    pattern: ERP_PATTERNS.CREATE_CATEGORY,
    body: { name: 'Almacen' },
    status: 201,
  },
  {
    method: 'delete',
    path: `/api/categories/${id}`,
    target: 'erp',
    pattern: ERP_PATTERNS.DELETE_CATEGORY,
    status: 204,
  },
  // ERP MS: sales (the receipt also calls Auth and Payments: see sales.controller.spec.ts)
  {
    method: 'post',
    path: '/api/sales',
    target: 'erp',
    pattern: ERP_PATTERNS.CREATE_SALE,
    body: { items: [{ productId: id, quantity: 2 }] },
    status: 201,
  },
  {
    method: 'get',
    path: '/api/sales',
    target: 'erp',
    pattern: ERP_PATTERNS.LIST_SALES,
    status: 200,
  },
  {
    method: 'get',
    path: `/api/sales/${id}`,
    target: 'erp',
    pattern: ERP_PATTERNS.GET_SALE,
    status: 200,
  },
  // ERP MS: analytics
  {
    method: 'get',
    path: '/api/analytics/inventory-value',
    target: 'erp',
    pattern: ERP_PATTERNS.ANALYTICS_INVENTORY_VALUE,
    status: 200,
  },
  // Payments MS
  {
    method: 'post',
    path: '/api/payments',
    target: 'payments',
    pattern: PAYMENTS_PATTERNS.CREATE_PAYMENT,
    body: { saleId: id },
    status: 201,
  },
  {
    method: 'get',
    path: `/api/payments/sale/${id}`,
    target: 'payments',
    pattern: PAYMENTS_PATTERNS.GET_SALE_PAYMENT,
    status: 200,
  },
  {
    method: 'post',
    path: '/api/payments/webhook',
    target: 'payments',
    pattern: PAYMENTS_PATTERNS.HANDLE_NOTIFICATION,
    body: { type: 'order', data: { id: 'ORD01' } },
    status: 200,
    public: true,
  },
];

describe('Gateway route -> TCP pattern (e2e)', () => {
  let app: INestApplication<App>;
  const clients: Record<Target, { send: jest.Mock }> = {
    auth: { send: jest.fn() },
    erp: { send: jest.fn() },
    payments: { send: jest.fn() },
  };

  // Calls that are not the guard validating the session token
  const callsOf = (target: Target) =>
    clients[target].send.mock.calls.filter(
      ([pattern]) => pattern !== AUTH_PATTERNS.VALIDATE_TOKEN,
    ) as [string, unknown][];

  const send = (route: Route, withToken: boolean) => {
    const call = request(app.getHttpServer())[route.method](route.path);
    if (withToken) call.set('Authorization', 'Bearer tkn');
    if (route.body) call.send(route.body);
    return call;
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_SERVICE)
      .useValue(clients.auth)
      .overrideProvider(ERP_SERVICE)
      .useValue(clients.erp)
      .overrideProvider(PAYMENTS_SERVICE)
      .useValue(clients.payments)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    for (const client of Object.values(clients)) client.send.mockReset();
    // Owner reaches every route; the answer value is irrelevant here
    clients.auth.send.mockImplementation((pattern: string) => {
      if (pattern === AUTH_PATTERNS.VALIDATE_TOKEN) return of(owner);
      if (pattern === AUTH_PATTERNS.LOGOUT) return EMPTY;
      return of({ ok: true });
    });
    // Routes that answer 204 or void expect an empty stream
    clients.erp.send.mockImplementation((pattern: string) =>
      pattern === ERP_PATTERNS.DELETE_PRODUCT ||
      pattern === ERP_PATTERNS.DELETE_CATEGORY
        ? EMPTY
        : of({ ok: true }),
    );
    clients.payments.send.mockImplementation((pattern: string) =>
      pattern === PAYMENTS_PATTERNS.HANDLE_NOTIFICATION
        ? EMPTY
        : of({ ok: true }),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(routes.map((r) => [`${r.method.toUpperCase()} ${r.path}`, r]))(
    '%s sends its pattern to the right service only',
    async (_name, route) => {
      await send(route, !route.public).expect(route.status);

      expect(callsOf(route.target).map(([pattern]) => pattern)).toEqual([
        route.pattern,
      ]);
      for (const target of Object.keys(clients) as Target[]) {
        if (target !== route.target) expect(callsOf(target)).toEqual([]);
      }
    },
  );

  it.each(routes.filter((r) => r.public).map((r) => [r.path, r]))(
    '%s is public: no token is validated',
    async (_path, route) => {
      await send(route, false).expect(route.status);
      expect(clients.auth.send).not.toHaveBeenCalledWith(
        AUTH_PATTERNS.VALIDATE_TOKEN,
        expect.anything(),
      );
    },
  );

  it.each(routes.filter((r) => !r.public).map((r) => [r.path, r]))(
    '%s without token answers 401 and reaches no service',
    async (_path, route) => {
      await send(route, false).expect(401);
      for (const client of Object.values(clients)) {
        expect(client.send).not.toHaveBeenCalled();
      }
    },
  );
});
