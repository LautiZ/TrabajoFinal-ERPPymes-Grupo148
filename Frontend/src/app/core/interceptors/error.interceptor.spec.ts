import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Mock } from 'vitest';
import { NotificationService } from '../../shared/services/notification.service';
import { API_URL } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from '../services/token-storage.service';
import { createJwt } from '../testing/jwt';
import { createMemoryStorage } from '../testing/storage';
import { errorInterceptor } from './error.interceptor';

const BASE = 'http://api.test';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notify: { error: Mock };
  let navigate: Mock;
  let auth: AuthService;
  let storage: Storage;

  function setup(options: { token?: string; url?: string } = {}): void {
    notify = { error: vi.fn() };
    storage = createMemoryStorage(options.token ? { [TOKEN_STORAGE_KEY]: options.token } : {});
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
        { provide: TOKEN_STORAGE, useValue: storage },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const router = TestBed.inject(Router);
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(router, 'navigate').mockImplementation(navigate as never);
    vi.spyOn(router, 'url', 'get').mockReturnValue(options.url ?? '/inventory?page=2');
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  }

  /** Hace una request y la responde con ese estado; devuelve el error que recibe quien llama. */
  function fail(url: string, status: number): { status?: number } {
    const received: { status?: number } = {};
    http.get(url).subscribe({ error: (e: { status: number }) => (received.status = e.status) });
    controller.expectOne(url).flush({}, { status, statusText: 'x' });
    return received;
  }

  afterEach(() => controller.verify());

  describe('401', () => {
    it('limpia la sesión, avisa y lleva al login con returnUrl', () => {
      setup({ token: createJwt() });
      expect(auth.isAuthenticated()).toBe(true);

      fail(`${BASE}/products`, 401);

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.lastEndReason()).toBe('unauthorized');
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(notify.error).toHaveBeenCalledWith(
        'Tu sesión no es válida o expiró. Ingresá de nuevo.',
      );
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/inventory?page=2', reason: 'unauthorized' },
      });
    });

    it('si ya está en una pantalla de autenticación no vuelve a redirigir', () => {
      setup({ url: '/auth/login' });

      fail(`${BASE}/products`, 401);

      expect(navigate).not.toHaveBeenCalled();
    });

    it('un 401 en el login (credenciales inválidas) no toca la sesión ni avisa: lo muestra el formulario', () => {
      setup({ token: createJwt() });

      const received = fail(`${BASE}/auth/login`, 401);

      expect(received.status).toBe(401);
      expect(notify.error).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(auth.isAuthenticated()).toBe(true);
    });

    it('un error en el logout tampoco dispara avisos ni redirecciones', () => {
      setup({ token: createJwt() });

      fail(`${BASE}/auth/logout`, 401);
      fail(`${BASE}/auth/logout`, 500);

      expect(notify.error).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  it('403 informa la falta de permisos y conserva la sesión', () => {
    setup({ token: createJwt() });

    fail(`${BASE}/products`, 403);

    expect(notify.error).toHaveBeenCalledWith('No tenés permisos para realizar esta acción.');
    expect(auth.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sin conexión (status 0) informa el problema de red', () => {
    setup();

    fail(`${BASE}/products`, 0);

    expect(notify.error).toHaveBeenCalledWith(
      'No hay conexión con el servidor. Revisá tu red e intentá de nuevo.',
    );
  });

  it('los errores 5xx informan un problema del servidor', () => {
    setup();

    fail(`${BASE}/products`, 500);
    fail(`${BASE}/products`, 503);

    expect(notify.error).toHaveBeenCalledTimes(2);
    expect(notify.error).toHaveBeenCalledWith(
      'El servidor tuvo un problema. Intentá de nuevo en unos minutos.',
    );
  });

  it('los errores de validación o negocio (400, 404, 409) no se notifican: los muestra cada pantalla', () => {
    setup({ token: createJwt() });

    for (const status of [400, 404, 409, 422]) {
      fail(`${BASE}/products`, status);
    }

    expect(notify.error).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('siempre vuelve a lanzar el error para que lo maneje quien hizo la request', () => {
    setup();

    expect(fail(`${BASE}/products`, 403).status).toBe(403);
    expect(fail(`${BASE}/products`, 500).status).toBe(500);
    expect(fail(`${BASE}/products`, 404).status).toBe(404);
  });

  it('ignora los errores de requests que no son al Gateway', () => {
    setup({ token: createJwt() });

    fail('https://fonts.googleapis.com/css2', 401);
    fail('https://otro.example.com/api', 500);

    expect(notify.error).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('las respuestas exitosas pasan sin cambios', () => {
    setup();
    let body: unknown;

    http.get(`${BASE}/products`).subscribe((b) => (body = b));
    controller.expectOne(`${BASE}/products`).flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(notify.error).not.toHaveBeenCalled();
  });
});
