import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Mock } from 'vitest';
import { NotificationService } from '../shared/services/notification.service';
import { authInterceptor } from './interceptors/auth.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';
import { API_URL } from './services/api.service';
import { AuthService } from './services/auth.service';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from './services/token-storage.service';
import { createJwt } from './testing/jwt';
import { createMemoryStorage } from './testing/storage';

const BASE = 'http://api.test';

/** Recorre el flujo completo con las piezas reales: AuthService + interceptors + HttpClient. */
describe('flujo de autenticación', () => {
  let auth: AuthService;
  let http: HttpClient;
  let controller: HttpTestingController;
  let storage: Storage;
  let notify: { error: Mock };
  let navigate: Mock;

  beforeEach(() => {
    storage = createMemoryStorage();
    notify = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
        { provide: TOKEN_STORAGE, useValue: storage },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const router = TestBed.inject(Router);
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(router, 'navigate').mockImplementation(navigate as never);
    vi.spyOn(router, 'url', 'get').mockReturnValue('/inventory?page=2');
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    controller.verify();
  });

  function login(token = createJwt({ role: 'Admin' })): string {
    auth.login({ email: 'ana@example.com', password: 'Secreta123' }).subscribe();
    const req = controller.expectOne(`${BASE}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ accessToken: token });
    return token;
  }

  it('después de ingresar, las requests al Gateway llevan el token sin código extra en los servicios', () => {
    const token = login();

    http.get(`${BASE}/products`).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('un 401 del servidor desloguea al usuario y lo lleva al login', () => {
    login();

    http.get(`${BASE}/products`).subscribe({ error: () => undefined });
    controller.expectOne(`${BASE}/products`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/inventory?page=2', reason: 'unauthorized' },
    });
    expect(notify.error).toHaveBeenCalledTimes(1);
  });

  it('al cerrar sesión revoca la sesión con el token y después ya no envía ninguno', () => {
    const token = login();
    let done = false;

    auth.logout().subscribe(() => (done = true));
    const revoke = controller.expectOne(`${BASE}/auth/logout`);
    expect(revoke.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    revoke.flush(null);

    expect(done).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);

    http.get(`${BASE}/products`).subscribe();
    const next = controller.expectOne(`${BASE}/products`);
    expect(next.request.headers.has('Authorization')).toBe(false);
    next.flush([]);
  });

  it('con credenciales inválidas el login falla sin avisos globales ni cambios de sesión', () => {
    let status: number | undefined;

    auth.login({ email: 'ana@example.com', password: 'mala' }).subscribe({
      error: (e: { status: number }) => (status = e.status),
    });
    controller
      .expectOne(`${BASE}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
    expect(notify.error).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('un token vencido nunca llega al Gateway', () => {
    vi.useFakeTimers();
    login(createJwt({ expiresInSeconds: 60 }));
    vi.setSystemTime(Date.now() + 120_000);

    http.get(`${BASE}/products`).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.lastEndReason()).toBe('expired');
    req.flush([]);
  });

  it('la sesión restaurada tras recargar también envía el token', () => {
    const token = createJwt({ role: 'Employee' });
    TestBed.resetTestingModule();
    storage = createMemoryStorage({ [TOKEN_STORAGE_KEY]: token });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
        { provide: TOKEN_STORAGE, useValue: storage },
        { provide: NotificationService, useValue: notify },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);

    http.get(`${BASE}/products`).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });
});
