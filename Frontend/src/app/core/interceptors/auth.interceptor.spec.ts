import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from '../services/token-storage.service';
import { createJwt } from '../testing/jwt';
import { createMemoryStorage } from '../testing/storage';
import { authInterceptor, isGatewayUrl } from './auth.interceptor';

const BASE = 'http://api.test';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let storage: Storage;

  function setup(token?: string): void {
    storage = createMemoryStorage(token ? { [TOKEN_STORAGE_KEY]: token } : {});
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
        { provide: TOKEN_STORAGE, useValue: storage },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  }

  afterEach(() => {
    vi.useRealTimers();
    controller.verify();
  });

  it('agrega el header Authorization a las requests al Gateway cuando hay sesión', () => {
    const token = createJwt();
    setup(token);

    http.get(`${BASE}/products`).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush([]);
  });

  it('sin sesión no agrega el header', () => {
    setup();

    http.get(`${BASE}/products`).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('no envía el token en login ni registro', () => {
    setup(createJwt());

    http.post(`${BASE}/auth/login`, {}).subscribe();
    http.post(`${BASE}/auth/register`, {}).subscribe();

    expect(controller.expectOne(`${BASE}/auth/login`).request.headers.has('Authorization')).toBe(
      false,
    );
    expect(controller.expectOne(`${BASE}/auth/register`).request.headers.has('Authorization')).toBe(
      false,
    );
  });

  it('sí lo envía en el logout, para poder revocar la sesión', () => {
    const token = createJwt();
    setup(token);

    http.post(`${BASE}/auth/logout`, {}).subscribe();

    const req = controller.expectOne(`${BASE}/auth/logout`);
    expect(req.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    req.flush(null);
  });

  it('nunca envía el token a otros orígenes', () => {
    setup(createJwt());

    http.get('https://fonts.googleapis.com/css2').subscribe();
    http.get('http://api.test.evil.com/products').subscribe();
    http.get('http://otro-host:3000/products').subscribe();

    for (const url of [
      'https://fonts.googleapis.com/css2',
      'http://api.test.evil.com/products',
      'http://otro-host:3000/products',
    ]) {
      expect(controller.expectOne(url).request.headers.has('Authorization')).toBe(false);
    }
  });

  it('no envía un token vencido y cierra la sesión', () => {
    vi.useFakeTimers();
    setup(createJwt({ expiresInSeconds: 60 }));
    const auth = TestBed.inject(AuthService);
    vi.setSystemTime(Date.now() + 120_000);

    http.get(`${BASE}/products`).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.lastEndReason()).toBe('expired');
    req.flush([]);
  });

  it('respeta un Authorization que ya traía la request', () => {
    setup(createJwt());

    http.get(`${BASE}/products`, { headers: { Authorization: 'Bearer otro' } }).subscribe();

    const req = controller.expectOne(`${BASE}/products`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer otro');
    req.flush([]);
  });
});

describe('isGatewayUrl', () => {
  it('reconoce solo las URLs que cuelgan del Gateway', () => {
    expect(isGatewayUrl('http://api.test/products', 'http://api.test')).toBe(true);
    expect(isGatewayUrl('http://api.test/products', 'http://api.test/')).toBe(true);
    expect(isGatewayUrl('http://api.test', 'http://api.test')).toBe(true);
    expect(isGatewayUrl('http://api.test.evil.com/x', 'http://api.test')).toBe(false);
    expect(isGatewayUrl('https://api.test/x', 'http://api.test')).toBe(false);
  });
});
