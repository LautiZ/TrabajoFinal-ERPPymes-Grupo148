import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
// Interfaces in decorated signatures need `import type` (isolatedModules + emitDecoratorMetadata)
import type { AuthUser } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';
import { CurrentUser } from './../src/auth/current-user.decorator';
import { Roles } from './../src/auth/roles.decorator';
import { configureApp } from '../src/config/configure-app';
import { EMPTY, of, throwError } from 'rxjs';
import { AUTH_PATTERNS, AUTH_SERVICE } from '@app/contracts';

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
