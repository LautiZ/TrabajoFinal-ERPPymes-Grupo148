import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import request from 'supertest';
import { App } from 'supertest/types';
import { AUTH_SERVICE } from '@app/contracts';
// Interfaces in decorated signatures need `import type` (isolatedModules + emitDecoratorMetadata)
import type { AuthUser } from '@app/contracts';
import { AppModule } from './../src/app.module';
import { AppService } from './../src/app.service';
import { CurrentUser } from './../src/auth/current-user.decorator';
import { Roles } from './../src/auth/roles.decorator';

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
    await request(app.getHttpServer()).get('/e2e-protected').expect(401);
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('rejects a token Auth reports as revoked or expired', () => {
    authClient.send.mockReturnValue(
      throwError(() => ({ status: 401, message: 'Unauthorized' })),
    );
    return request(app.getHttpServer())
      .get('/e2e-protected')
      .set('Authorization', 'Bearer tkn')
      .expect(401);
  });

  it('exposes the validated user through @CurrentUser', () => {
    const user = { userId: 'u-1', role: 'Admin', jti: 'j-1' };
    authClient.send.mockReturnValue(of(user));
    return request(app.getHttpServer())
      .get('/e2e-protected')
      .set('Authorization', 'Bearer tkn')
      .expect(200, user);
  });

  it('rejects with 403 a user whose role is not allowed', () => {
    authClient.send.mockReturnValue(
      of({ userId: 'u-2', role: 'Employee', jti: 'j-2' }),
    );
    return request(app.getHttpServer())
      .get('/e2e-protected/admin')
      .set('Authorization', 'Bearer tkn')
      .expect(403);
  });

  it('lets an allowed role through a @Roles route', () => {
    authClient.send.mockReturnValue(
      of({ userId: 'u-1', role: 'Owner', jti: 'j-1' }),
    );
    return request(app.getHttpServer())
      .get('/e2e-protected/admin')
      .set('Authorization', 'Bearer tkn')
      .expect(200, { ok: true });
  });

  it('answers 401, not 403, on a @Roles route without token', () => {
    return request(app.getHttpServer()).get('/e2e-protected/admin').expect(401);
  });
});
