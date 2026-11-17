import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { EMPTY, of, throwError } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  AUTH_PATTERNS,
  AUTH_SERVICE,
  ERP_PATTERNS,
  ERP_SERVICE,
} from '@app/contracts';
// Interfaces in decorated signatures need `import type` (isolatedModules + emitDecoratorMetadata)
import type { AuthUser } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';
import { CurrentUser } from './../src/auth/current-user.decorator';
import { Roles } from './../src/auth/roles.decorator';
import { configureApp } from './../src/config/configure-app';
import { envs } from './../src/config/envs';
import { setupSwagger } from './../src/config/setup-swagger';

@Controller('e2e-protected')
class ProtectedController {
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Roles('Owner', 'Admin')
  @Get('admin')
  adminOnly() {
    return { ok: true };
  }
}

describe('Gateway (e2e)', () => {
  let app: INestApplication<App>;
  const appService = { checkServices: jest.fn() };
  const authClient = { send: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedController],
    })
      .overrideProvider(AppService)
      .useValue(appService)
      .overrideProvider(AUTH_SERVICE)
      .useValue(authClient)
      // Rate limiting is tested in its own app below, with a fresh counter
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  // Avoid one test's mocked Auth answer leaking into the next one
  beforeEach(() => authClient.send.mockReset());

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

  it('rejects a protected route without token and skips Auth', async () => {
    await request(app.getHttpServer()).get('/api/e2e-protected').expect(401);
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('rejects a token Auth reports as revoked or expired', () => {
    authClient.send.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Unauthorized' })),
    );
    return request(app.getHttpServer())
      .get('/api/e2e-protected')
      .set('Authorization', 'Bearer tkn')
      .expect(401);
  });

  it('exposes the validated user through @CurrentUser', () => {
    const user = { userId: 'u-1', role: 'Admin', jti: 'j-1' };
    authClient.send.mockReturnValue(of(user));
    return request(app.getHttpServer())
      .get('/api/e2e-protected')
      .set('Authorization', 'Bearer tkn')
      .expect(200, user);
  });

  it('rejects with 403 a user whose role is not allowed', () => {
    authClient.send.mockReturnValue(
      of({ userId: 'u-2', role: 'Employee', jti: 'j-2' }),
    );
    return request(app.getHttpServer())
      .get('/api/e2e-protected/admin')
      .set('Authorization', 'Bearer tkn')
      .expect(403);
  });

  it('lets an allowed role through a @Roles route', () => {
    authClient.send.mockReturnValue(
      of({ userId: 'u-1', role: 'Owner', jti: 'j-1' }),
    );
    return request(app.getHttpServer())
      .get('/api/e2e-protected/admin')
      .set('Authorization', 'Bearer tkn')
      .expect(200, { ok: true });
  });

  it('answers 401, not 403, on a @Roles route without token', () => {
    return request(app.getHttpServer())
      .get('/api/e2e-protected/admin')
      .expect(401);
  });

  describe('auth routes', () => {
    const owner = { userId: 'u-1', role: 'Owner', jti: 'j-1' };
    const rpcError = (status: number, message: string) =>
      throwError(() => ({ status, message }));

    it('POST /api/auth/login is public and forwards the normalized body', async () => {
      authClient.send.mockReturnValue(of({ accessToken: 'tkn' }));

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'Ana@Pyme.Test', password: 'secret' })
        .expect(200, { accessToken: 'tkn' });

      // Only LOGIN: a public route never asks Auth to validate a token
      expect(authClient.send).toHaveBeenCalledTimes(1);
      expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.LOGIN, {
        email: 'ana@pyme.test',
        password: 'secret',
      });
    });

    it('rejects an invalid login body with 400 before reaching Auth', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'not-an-email', password: 'secret' })
        .expect(400);
      expect(authClient.send).not.toHaveBeenCalled();
    });

    it('maps an RPC rejection from Auth to the same HTTP status', () => {
      authClient.send.mockReturnValue(rpcError(401, 'Invalid credentials'));
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@pyme.test', password: 'wrong' })
        .expect(401);
    });

    it('answers 503 when Auth is down', () => {
      authClient.send.mockReturnValue(
        throwError(() =>
          Object.assign(new Error('connect ECONNREFUSED'), {
            code: 'ECONNREFUSED',
          }),
        ),
      );
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@pyme.test', password: 'secret' })
        .expect(503);
    });

    it('POST /api/users takes actorRole from the session, not from the client', async () => {
      authClient.send
        .mockReturnValueOnce(of({ ...owner, role: 'Admin' })) // AuthGuard
        .mockReturnValueOnce(of({ id: 'u-9', role: 'Employee' })); // CREATE_USER
      const dto = {
        email: 'emp@pyme.test',
        password: '12345678',
        name: 'Emp',
        role: 'Employee',
      };

      await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', 'Bearer tkn')
        .send(dto)
        .expect(201);

      expect(authClient.send).toHaveBeenLastCalledWith(
        AUTH_PATTERNS.CREATE_USER,
        {
          actorRole: 'Admin',
          user: dto,
        },
      );
    });

    it('rejects an actorRole smuggled in the body with 400', () => {
      authClient.send.mockReturnValueOnce(of(owner));
      return request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', 'Bearer tkn')
        .send({
          email: 'x@pyme.test',
          password: '12345678',
          name: 'X',
          role: 'Admin',
          actorRole: 'Owner',
        })
        .expect(400);
    });

    it('login -> protected route -> logout -> same token is rejected', async () => {
      // Stateful fake Auth MS: logout revokes the session behind the token
      const revoked = new Set<string>();
      authClient.send.mockImplementation(
        (pattern: string, payload: { jti?: string }) => {
          switch (pattern) {
            case AUTH_PATTERNS.LOGIN:
              return of({ accessToken: 'tkn' });
            case AUTH_PATTERNS.VALIDATE_TOKEN:
              return revoked.has(owner.jti)
                ? rpcError(401, 'Unauthorized')
                : of(owner);
            case AUTH_PATTERNS.LOGOUT:
              revoked.add(payload.jti!);
              return EMPTY; // void handler: the real MS answers without a value
            default:
              return throwError(
                () => new Error(`Unexpected pattern ${pattern}`),
              );
          }
        },
      );
      const server = app.getHttpServer();

      const login = await request(server)
        .post('/api/auth/login')
        .send({ email: 'ana@pyme.test', password: 'secret' })
        .expect(200);
      const { accessToken } = login.body as { accessToken: string };
      const auth = `Bearer ${accessToken}`;

      await request(server)
        .get('/api/e2e-protected')
        .set('Authorization', auth)
        .expect(200);
      await request(server)
        .post('/api/auth/logout')
        .set('Authorization', auth)
        .expect(204);
      expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.LOGOUT, {
        jti: 'j-1',
      });
      await request(server)
        .get('/api/e2e-protected')
        .set('Authorization', auth)
        .expect(401);
    });
  });
});

describe('Gateway login rate limit (e2e)', () => {
  let app: INestApplication<App>;
  const appService = { checkServices: jest.fn() };
  const authClient = { send: jest.fn() };

  // Own app instance: the throttler counter lives in memory, so it starts at zero
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue(appService)
      .overrideProvider(AUTH_SERVICE)
      .useValue(authClient)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 429 once the attempts run out, without reaching Auth', async () => {
    authClient.send.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Invalid credentials' })),
    );
    const attempt = () =>
      request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'ana@pyme.test', password: 'wrong' });

    for (let i = 0; i < envs.LOGIN_THROTTLE_LIMIT; i++) {
      await attempt().expect(401);
    }
    await attempt().expect(429);

    // The blocked attempt never reached Auth, so argon2 never ran for it
    expect(authClient.send).toHaveBeenCalledTimes(envs.LOGIN_THROTTLE_LIMIT);
  });

  it('does not limit routes without the guard', async () => {
    const health = { auth: 'up', erp: 'up', payments: 'up' };
    appService.checkServices.mockResolvedValue(health);
    const server = app.getHttpServer();

    for (let i = 0; i <= envs.LOGIN_THROTTLE_LIMIT; i++) {
      await request(server).get('/health').expect(200);
    }
  });
});

describe('Gateway Swagger docs (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue({ checkServices: jest.fn() })
      .overrideProvider(AUTH_SERVICE)
      .useValue({ send: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ts-jest does not run the Swagger CLI plugin, so DTO schemas are checked on the real build
  it('serves the OpenAPI spec without a token, with prefixed routes and bearer auth', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/docs-json')
      .expect(200);

    const spec = res.body as {
      paths: Record<string, unknown>;
      security: unknown[];
    };
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining([
        '/api/auth/login',
        '/api/auth/logout',
        '/api/users',
      ]),
    );
    expect(spec.security).toEqual([{ bearer: [] }]);
  });

  it('serves the Swagger UI without a token', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });
});

describe('Gateway ERP routes (e2e)', () => {
  let app: INestApplication<App>;
  const authClient = { send: jest.fn() };
  const erpClient = { send: jest.fn() };
  const employee = {
    userId: '6f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b',
    role: 'Employee',
    jti: 'j-3',
  };
  const productId = '3f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue({ checkServices: jest.fn() })
      .overrideProvider(AUTH_SERVICE)
      .useValue(authClient)
      .overrideProvider(ERP_SERVICE)
      .useValue(erpClient)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    erpClient.send.mockReset();
    // Every request comes from a valid Employee session
    authClient.send.mockReturnValue(of(employee));
  });

  afterAll(async () => {
    await app.close();
  });

  const lastErpCall = () =>
    erpClient.send.mock.calls.at(-1) as [string, unknown];

  it('GET /api/products/stock-summary is not captured by the :id route', async () => {
    const summary = { total: 5, ok: 2, low: 2, out: 1 };
    erpClient.send.mockReturnValue(of(summary));

    await request(app.getHttpServer())
      .get('/api/products/stock-summary')
      .set('Authorization', 'Bearer tkn')
      .expect(200, summary);
    expect(lastErpCall()[0]).toBe(ERP_PATTERNS.STOCK_SUMMARY);
  });

  it('GET /api/products accepts the legacy lowStockThreshold param and applies defaults', async () => {
    const page = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    erpClient.send.mockReturnValue(of(page));

    await request(app.getHttpServer())
      .get('/api/products?stockStatus=low&lowStockThreshold=10&page=2')
      .set('Authorization', 'Bearer tkn')
      .expect(200, page);

    expect(lastErpCall()).toEqual([
      ERP_PATTERNS.LIST_PRODUCTS,
      expect.objectContaining({
        page: 2,
        limit: 10,
        sortBy: 'name',
        sortOrder: 'asc',
        stockStatus: 'low',
      }),
    ]);
  });

  it.each([
    ['true', true],
    ['false', false],
  ])(
    'GET /api/products?active=%s reaches the ERP as the boolean %s',
    async (raw, parsed) => {
      erpClient.send.mockReturnValue(
        of({ data: [], meta: { total: 0, page: 1, limit: 24, totalPages: 0 } }),
      );

      await request(app.getHttpServer())
        .get(`/api/products?active=${raw}&limit=24`)
        .set('Authorization', 'Bearer tkn')
        .expect(200);
      expect(lastErpCall()[1]).toEqual(
        expect.objectContaining({ active: parsed }),
      );
    },
  );

  it('GET /api/products rejects an active value that is not a boolean', async () => {
    await request(app.getHttpServer())
      .get('/api/products?active=yes')
      .set('Authorization', 'Bearer tkn')
      .expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('GET /api/products rejects an unknown sort field without reaching the ERP', async () => {
    await request(app.getHttpServer())
      .get('/api/products?sortBy=password')
      .set('Authorization', 'Bearer tkn')
      .expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('GET /api/products/:id rejects an id that is not a UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/products/not-a-uuid')
      .set('Authorization', 'Bearer tkn')
      .expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('POST /api/products lets an Employee create (RN-16.3) and takes userId from the session', async () => {
    erpClient.send.mockReturnValue(of({ id: productId }));
    const body = {
      name: 'Yerba 1kg',
      sku: 'YER-001',
      price: 3500,
      stock: 10,
      unit: 'Unit',
      categoryId: productId,
    };

    await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', 'Bearer tkn')
      .send(body)
      .expect(201);

    expect(lastErpCall()).toEqual([
      ERP_PATTERNS.CREATE_PRODUCT,
      { userId: employee.userId, product: body },
    ]);
  });

  it('PATCH /api/products/:id rejects stock in the body (RN-01)', async () => {
    await request(app.getHttpServer())
      .patch(`/api/products/${productId}`)
      .set('Authorization', 'Bearer tkn')
      .send({ stock: 99 })
      .expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('POST /api/products/:id/stock-movements maps the ERP 409 to HTTP 409', async () => {
    erpClient.send.mockReturnValue(
      throwError(() => ({ status: 409, message: 'Insufficient stock' })),
    );

    await request(app.getHttpServer())
      .post(`/api/products/${productId}/stock-movements`)
      .set('Authorization', 'Bearer tkn')
      .send({ type: 'Outcome', quantity: 5, reason: 'Broken' })
      .expect(409);

    expect(lastErpCall()).toEqual([
      ERP_PATTERNS.ADJUST_STOCK,
      {
        id: productId,
        userId: employee.userId,
        adjustment: { type: 'Outcome', quantity: 5, reason: 'Broken' },
      },
    ]);
  });

  it('DELETE /api/categories/:id maps the ERP 409 to HTTP 409', async () => {
    erpClient.send.mockReturnValue(
      throwError(() => ({
        status: 409,
        message: 'Category has active products',
      })),
    );

    await request(app.getHttpServer())
      .delete(`/api/categories/${productId}`)
      .set('Authorization', 'Bearer tkn')
      .expect(409);
    expect(lastErpCall()).toEqual([
      ERP_PATTERNS.DELETE_CATEGORY,
      { id: productId },
    ]);
  });

  it('DELETE /api/products/:id answers 204', async () => {
    erpClient.send.mockReturnValue(EMPTY);

    await request(app.getHttpServer())
      .delete(`/api/products/${productId}`)
      .set('Authorization', 'Bearer tkn')
      .expect(204);
    expect(lastErpCall()).toEqual([
      ERP_PATTERNS.DELETE_PRODUCT,
      { id: productId },
    ]);
  });
});

describe('Gateway sales routes (e2e)', () => {
  let app: INestApplication<App>;
  const authClient = { send: jest.fn() };
  const erpClient = { send: jest.fn() };
  const cashier = {
    userId: '6f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b',
    role: 'Employee',
    jti: 'j-4',
  };
  const productA = '3f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b';
  const productB = '4f1c2a9e-8b4d-4e2f-9a1b-2c3d4e5f6a7b';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AppService)
      .useValue({ checkServices: jest.fn() })
      .overrideProvider(AUTH_SERVICE)
      .useValue(authClient)
      .overrideProvider(ERP_SERVICE)
      .useValue(erpClient)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    erpClient.send.mockReset();
    authClient.send.mockReturnValue(of(cashier));
  });

  afterAll(async () => {
    await app.close();
  });

  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/api/sales')
      .set('Authorization', 'Bearer tkn')
      .send(body);

  it('POST /api/sales takes userId from the session, never from the body', async () => {
    erpClient.send.mockReturnValue(of({ id: 'sale-1' }));
    const items = [{ productId: productA, quantity: 2 }];

    await post({ items }).expect(201);
    expect(erpClient.send).toHaveBeenCalledWith(ERP_PATTERNS.CREATE_SALE, {
      userId: cashier.userId,
      sale: { items },
    });
  });

  it('POST /api/sales rejects a client-sent total (RN-06)', async () => {
    await post({
      items: [{ productId: productA, quantity: 1 }],
      total: 1,
    }).expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('POST /api/sales rejects a repeated product and an empty cart', async () => {
    await post({
      items: [
        { productId: productA, quantity: 1 },
        { productId: productA, quantity: 2 },
      ],
    }).expect(400);
    await post({ items: [] }).expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('POST /api/sales forwards the stock conflict body the frontend parses', async () => {
    const items = [
      { productId: productA, name: 'Yerba', requested: 5, available: 2 },
      { productId: productB, name: 'Queso', requested: 1, available: 0 },
    ];
    erpClient.send.mockReturnValue(
      throwError(() => ({
        status: 409,
        message: 'Insufficient stock',
        code: 'INSUFFICIENT_STOCK',
        items,
      })),
    );

    const res = await post({
      items: [
        { productId: productA, quantity: 5 },
        { productId: productB, quantity: 1 },
      ],
    }).expect(409);
    expect(res.body).toEqual({
      statusCode: 409,
      message: 'Insufficient stock',
      code: 'INSUFFICIENT_STOCK',
      items,
    });
  });

  it('GET /api/sales rejects a date without time and offset', async () => {
    await request(app.getHttpServer())
      .get('/api/sales?from=2026-11-17')
      .set('Authorization', 'Bearer tkn')
      .expect(400);
    expect(erpClient.send).not.toHaveBeenCalled();
  });

  it('GET /api/sales forwards valid filters', async () => {
    const page = {
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    };
    erpClient.send.mockReturnValue(of(page));
    const from = '2026-11-17T00:00:00-03:00';

    await request(app.getHttpServer())
      .get(`/api/sales?state=Paid&from=${encodeURIComponent(from)}`)
      .set('Authorization', 'Bearer tkn')
      .expect(200, page);
    expect(erpClient.send).toHaveBeenCalledWith(
      ERP_PATTERNS.LIST_SALES,
      expect.objectContaining({ state: 'Paid', from }),
    );
  });

  it('GET /api/sales/:id rejects an id that is not a UUID', async () => {
    await request(app.getHttpServer())
      .get('/api/sales/42')
      .set('Authorization', 'Bearer tkn')
      .expect(400);
  });
});
