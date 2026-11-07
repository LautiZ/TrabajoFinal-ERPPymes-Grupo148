import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { UserRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from '../services/token-storage.service';
import { createJwt } from '../testing/jwt';
import { createMemoryStorage } from '../testing/storage';
import { authGuard, guestGuard, roleGuard } from './auth.guard';

describe('guards de rutas', () => {
  let router: Router;

  function setup(token?: string): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TOKEN_STORAGE,
          useValue: createMemoryStorage(token ? { [TOKEN_STORAGE_KEY]: token } : {}),
        },
      ],
    });
    router = TestBed.inject(Router);
  }

  function run(
    guard: CanActivateFn,
    url = '/inventory?page=2',
    roles?: readonly UserRole[],
  ): boolean | string {
    const route = { data: roles ? { roles } : {} } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() => guard(route, state)) as boolean | UrlTree;
    return result instanceof UrlTree ? router.serializeUrl(result) : result;
  }

  afterEach(() => vi.useRealTimers());

  describe('authGuard', () => {
    it('deja pasar con una sesión válida', () => {
      setup(createJwt());

      expect(run(authGuard)).toBe(true);
    });

    it('sin sesión redirige al login guardando la ruta pedida (returnUrl)', () => {
      setup();

      expect(run(authGuard, '/inventory?page=2')).toBe(
        '/auth/login?returnUrl=%2Finventory%3Fpage%3D2',
      );
    });

    it('si la ruta pedida es la raíz no agrega returnUrl', () => {
      setup();

      expect(run(authGuard, '/')).toBe('/auth/login');
    });

    it('con el token vencido redirige al login e indica que la sesión expiró', () => {
      vi.useFakeTimers();
      setup(createJwt({ expiresInSeconds: 60 }));
      vi.setSystemTime(Date.now() + 120_000);

      expect(run(authGuard, '/sales')).toBe('/auth/login?returnUrl=%2Fsales&reason=expired');
    });

    it('con un token guardado vencido desde antes también avisa que expiró', () => {
      setup(createJwt({ expiresInSeconds: -60 }));

      expect(run(authGuard, '/sales')).toBe('/auth/login?returnUrl=%2Fsales&reason=expired');
    });
  });

  describe('roleGuard', () => {
    it('permite el acceso si el rol está entre los requeridos', () => {
      setup(createJwt({ role: 'Admin' }));

      expect(run(roleGuard, '/analytics', ['Owner', 'Admin'])).toBe(true);
    });

    it('sin el rol requerido manda a acceso denegado', () => {
      setup(createJwt({ role: 'Employee' }));

      expect(run(roleGuard, '/analytics', ['Owner', 'Admin'])).toBe('/forbidden');
    });

    it('sin sesión manda al login, no a acceso denegado', () => {
      setup();

      expect(run(roleGuard, '/analytics', ['Admin'])).toBe('/auth/login?returnUrl=%2Fanalytics');
    });

    it('una ruta sin roles definidos solo exige sesión', () => {
      setup(createJwt({ role: 'Employee' }));

      expect(run(roleGuard, '/algo')).toBe(true);
      expect(run(roleGuard, '/algo', [])).toBe(true);
    });

    it('con la sesión vencida pide iniciar sesión de nuevo', () => {
      setup(createJwt({ expiresInSeconds: -5 }));

      expect(run(roleGuard, '/analytics', ['Admin'])).toBe(
        '/auth/login?returnUrl=%2Fanalytics&reason=expired',
      );
    });
  });

  describe('guestGuard', () => {
    it('deja ver login y registro a quien no tiene sesión', () => {
      setup();

      expect(run(guestGuard, '/auth/login')).toBe(true);
    });

    it('con sesión activa redirige al panel', () => {
      setup(createJwt());

      expect(run(guestGuard, '/auth/login')).toBe('/dashboard');
    });

    it('con una sesión vencida vuelve a permitir el login', () => {
      setup(createJwt({ expiresInSeconds: -5 }));

      expect(run(guestGuard, '/auth/login')).toBe(true);
    });
  });

  it('los guards usan el estado real de AuthService (se actualizan al cerrar sesión)', () => {
    setup(createJwt());
    expect(run(authGuard)).toBe(true);

    TestBed.inject(AuthService).endSession('logout');

    expect(run(authGuard, '/inventory')).toBe('/auth/login?returnUrl=%2Finventory');
  });
});
