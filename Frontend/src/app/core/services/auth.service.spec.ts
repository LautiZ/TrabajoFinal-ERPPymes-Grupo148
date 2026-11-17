import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createJwt } from '../testing/jwt';
import { createMemoryStorage } from '../testing/storage';
import { API_URL } from './api.service';
import { AuthService, isAuthUrl, isPublicAuthUrl } from './auth.service';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from './token-storage.service';

const BASE = 'http://api.test';

describe('AuthService', () => {
  let storage: Storage;
  let http: HttpTestingController;

  function create(initialToken?: string): AuthService {
    storage = createMemoryStorage(initialToken ? { [TOKEN_STORAGE_KEY]: initialToken } : {});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
        { provide: TOKEN_STORAGE, useValue: storage },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  }

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  describe('login', () => {
    it('envía las credenciales, guarda el token y deja la sesión activa', () => {
      const auth = create();
      const token = createJwt({ sub: 'u1', role: 'Admin', email: 'ana@example.com', name: 'Ana' });
      let user: unknown;

      auth.login({ email: 'ana@example.com', password: 'Secreta123' }).subscribe((u) => (user = u));

      const req = http.expectOne(`${BASE}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ email: 'ana@example.com', password: 'Secreta123' });
      req.flush({ accessToken: token });

      expect(user).toEqual({ id: 'u1', email: 'ana@example.com', name: 'Ana', role: 'Admin' });
      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.currentUser()?.name).toBe('Ana');
      expect(auth.role()).toBe('Admin');
      expect(auth.roles()).toEqual(['Admin']);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBe(token);
    });

    it('acepta el token en `access_token` o en `token`', () => {
      for (const key of ['access_token', 'token']) {
        TestBed.resetTestingModule();
        const auth = create();
        auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
        http.expectOne(`${BASE}/auth/login`).flush({ [key]: createJwt() });

        expect(auth.isAuthenticated()).toBe(true);
      }
    });

    it('limpia el motivo de cierre anterior al iniciar sesión', () => {
      const auth = create();
      auth.endSession('expired');
      auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
      http.expectOne(`${BASE}/auth/login`).flush({ accessToken: createJwt() });

      expect(auth.lastEndReason()).toBeNull();
    });

    it('con credenciales inválidas (401) propaga el error y no cambia el estado', () => {
      const auth = create();
      let status: number | undefined;

      auth.login({ email: 'a@b.com', password: 'mala' }).subscribe({
        error: (e: { status: number }) => (status = e.status),
      });
      http
        .expectOne(`${BASE}/auth/login`)
        .flush({ message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' });

      expect(status).toBe(401);
      expect(auth.isAuthenticated()).toBe(false);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('rechaza una respuesta sin token o con un token ilegible', () => {
      const auth = create();
      const errors: string[] = [];

      auth
        .login({ email: 'a@b.com', password: 'x' })
        .subscribe({ error: (e: Error) => errors.push(e.message) });
      http.expectOne(`${BASE}/auth/login`).flush({});
      auth
        .login({ email: 'a@b.com', password: 'x' })
        .subscribe({ error: (e: Error) => errors.push(e.message) });
      http.expectOne(`${BASE}/auth/login`).flush({ accessToken: 'no-es-un-jwt' });

      expect(errors).toHaveLength(2);
      expect(auth.isAuthenticated()).toBe(false);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('rechaza un token que ya vencido', () => {
      const auth = create();
      let failed = false;

      auth.login({ email: 'a@b.com', password: 'x' }).subscribe({ error: () => (failed = true) });
      http
        .expectOne(`${BASE}/auth/login`)
        .flush({ accessToken: createJwt({ expiresInSeconds: -10 }) });

      expect(failed).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
    });
  });

  describe('register', () => {
    it('envía los datos y no inicia sesión', () => {
      const auth = create();
      const data = {
        email: 'owner@example.com',
        password: 'Secreta123',
        name: 'Ana',
        surname: 'Pérez',
      };
      let done = false;

      auth.register(data).subscribe(() => (done = true));

      const req = http.expectOne(`${BASE}/auth/register`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(data);
      req.flush({ id: 'u1', email: 'owner@example.com', role: 'Owner' });

      expect(done).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('propaga los errores del servidor (p. ej. registro deshabilitado)', () => {
      const auth = create();
      let status: number | undefined;

      auth.register({ email: 'a@b.com', password: 'x', name: 'A' }).subscribe({
        error: (e: { status: number }) => (status = e.status),
      });
      http.expectOne(`${BASE}/auth/register`).flush({}, { status: 403, statusText: 'Forbidden' });

      expect(status).toBe(403);
    });
  });

  describe('logout', () => {
    function loggedIn(): AuthService {
      return create(createJwt({ role: 'Employee' }));
    }

    it('revoca la sesión en el servidor y luego limpia el estado local', () => {
      const auth = loggedIn();
      let done = false;

      auth.logout().subscribe(() => (done = true));
      expect(auth.isAuthenticated()).toBe(true);

      const req = http.expectOne(`${BASE}/auth/logout`);
      expect(req.request.method).toBe('POST');
      req.flush(null);

      expect(done).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.currentUser()).toBeNull();
      expect(auth.roles()).toEqual([]);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(auth.lastEndReason()).toBe('logout');
    });

    it('limpia el estado local aunque la llamada al servidor falle', () => {
      const auth = loggedIn();
      let done = false;

      auth.logout().subscribe(() => (done = true));
      http.expectOne(`${BASE}/auth/logout`).flush({}, { status: 500, statusText: 'Server Error' });

      expect(done).toBe(true);
      expect(auth.isAuthenticated()).toBe(false);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('sin sesión activa no llama al servidor', () => {
      const auth = create();
      let done = false;

      auth.logout().subscribe(() => (done = true));

      http.expectNone(`${BASE}/auth/logout`);
      expect(done).toBe(true);
    });
  });

  describe('restauración al recargar', () => {
    it('restaura la sesión desde un token guardado vigente', () => {
      const auth = create(createJwt({ sub: 'u7', role: 'Owner', name: 'Dueña' }));

      expect(auth.isAuthenticated()).toBe(true);
      expect(auth.currentUser()).toMatchObject({ id: 'u7', role: 'Owner', name: 'Dueña' });
      expect(auth.lastEndReason()).toBeNull();
    });

    it('descarta un token vencido guardado y lo informa', () => {
      const auth = create(createJwt({ expiresInSeconds: -60 }));

      expect(auth.isAuthenticated()).toBe(false);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
      expect(auth.lastEndReason()).toBe('expired');
    });

    it('descarta un token guardado que no se puede leer', () => {
      const auth = create('basura');

      expect(auth.isAuthenticated()).toBe(false);
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('sin token guardado arranca sin sesión', () => {
      const auth = create();

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.expiresAt()).toBeNull();
    });
  });

  describe('expiración', () => {
    beforeEach(() => vi.useFakeTimers());

    it('cierra la sesión sola cuando el token vence', () => {
      const auth = create(createJwt({ expiresInSeconds: 60 }));
      expect(auth.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(59_000);
      expect(auth.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(2_000);
      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.lastEndReason()).toBe('expired');
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('programa el cierre también tras un login', () => {
      const auth = create();
      auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
      http
        .expectOne(`${BASE}/auth/login`)
        .flush({ accessToken: createJwt({ expiresInSeconds: 30 }) });

      vi.advanceTimersByTime(31_000);

      expect(auth.isAuthenticated()).toBe(false);
    });

    it('con un vencimiento muy lejano reprograma en tramos en vez de cerrar antes de tiempo', () => {
      const thirtyDays = 30 * 24 * 3600;
      const auth = create(createJwt({ expiresInSeconds: thirtyDays }));

      vi.advanceTimersByTime(26 * 24 * 3600 * 1000);
      expect(auth.isAuthenticated()).toBe(true);

      vi.advanceTimersByTime(5 * 24 * 3600 * 1000);
      expect(auth.isAuthenticated()).toBe(false);
    });

    it('isSessionActive revisa el reloj aunque el temporizador no haya disparado', () => {
      const auth = create(createJwt({ expiresInSeconds: 60 }));

      vi.setSystemTime(Date.now() + 120_000);

      expect(auth.isSessionActive()).toBe(false);
      expect(auth.lastEndReason()).toBe('expired');
    });

    it('validToken entrega el token vigente y nunca uno vencido', () => {
      const token = createJwt({ expiresInSeconds: 60 });
      const auth = create(token);
      expect(auth.validToken()).toBe(token);

      vi.setSystemTime(Date.now() + 120_000);

      expect(auth.validToken()).toBeNull();
      expect(storage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('expone el vencimiento de la sesión', () => {
      const exp = Math.floor(Date.now() / 1000) + 600;
      const auth = create(createJwt({ exp }));

      expect(auth.expiresAt()).toBe(exp * 1000);
    });
  });

  describe('endSession y roles', () => {
    it('endSession(unauthorized) limpia la sesión y registra el motivo', () => {
      const auth = create(createJwt());

      auth.endSession('unauthorized');

      expect(auth.isAuthenticated()).toBe(false);
      expect(auth.lastEndReason()).toBe('unauthorized');
    });

    it('sin sesión, endSession no inventa un motivo de cierre', () => {
      const auth = create();

      auth.endSession('unauthorized');

      expect(auth.lastEndReason()).toBeNull();
    });

    it('hasRole indica si el rol actual está entre los pedidos', () => {
      const auth = create(createJwt({ role: 'Admin' }));

      expect(auth.hasRole('Admin')).toBe(true);
      expect(auth.hasRole('Owner', 'Admin')).toBe(true);
      expect(auth.hasRole('Employee')).toBe(false);
      auth.endSession('logout');
      expect(auth.hasRole('Admin')).toBe(false);
    });
  });
});

describe('detección de endpoints de autenticación', () => {
  it('login y registro son públicos', () => {
    expect(isPublicAuthUrl('http://api.test/auth/login')).toBe(true);
    expect(isPublicAuthUrl('http://api.test/auth/register?x=1')).toBe(true);
    expect(isPublicAuthUrl('http://api.test/auth/logout')).toBe(false);
    expect(isPublicAuthUrl('http://api.test/products')).toBe(false);
  });

  it('logout cuenta como endpoint de autenticación pero no como público', () => {
    expect(isAuthUrl('http://api.test/auth/logout')).toBe(true);
    expect(isAuthUrl('http://api.test/auth/login')).toBe(true);
    expect(isAuthUrl('http://api.test/authors')).toBe(false);
  });
});
