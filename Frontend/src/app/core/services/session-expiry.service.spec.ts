import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import type { Mock } from 'vitest';
import { NotificationService } from '../../shared/services/notification.service';
import { createJwt } from '../testing/jwt';
import { createMemoryStorage } from '../testing/storage';
import { API_URL } from './api.service';
import { AuthService } from './auth.service';
import {
  SESSION_WARNING_MS,
  SessionExpiryService,
  describeRemaining,
} from './session-expiry.service';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from './token-storage.service';

const BASE = 'http://api.test';

describe('SessionExpiryService', () => {
  let auth: AuthService;
  let notify: { warn: Mock };
  let navigate: Mock;
  let http: HttpTestingController;

  /** Arranca el servicio; `routerUrl` es la ruta en la que está el usuario. */
  function setup(options: { token?: string; routerUrl?: string; warnMs?: number } = {}): void {
    vi.useFakeTimers();
    notify = { warn: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: BASE },
        { provide: NotificationService, useValue: notify },
        { provide: SESSION_WARNING_MS, useValue: options.warnMs ?? 90_000 },
        {
          provide: TOKEN_STORAGE,
          useValue: createMemoryStorage(
            options.token ? { [TOKEN_STORAGE_KEY]: options.token } : {},
          ),
        },
      ],
    });
    const router = TestBed.inject(Router);
    navigate = vi.fn(() => Promise.resolve(true));
    vi.spyOn(router, 'navigate').mockImplementation(navigate as never);
    vi.spyOn(router, 'url', 'get').mockReturnValue(options.routerUrl ?? '/sales/checkout');
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    TestBed.inject(SessionExpiryService);
    TestBed.tick();
  }

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  describe('aviso previo', () => {
    it('avisa antes de que venza la sesión, no antes', () => {
      setup({ token: createJwt({ expiresInSeconds: 300 }) });

      vi.advanceTimersByTime(200_000);
      expect(notify.warn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(15_000);
      expect(notify.warn).toHaveBeenCalledTimes(1);
      expect(notify.warn.mock.calls[0][0]).toContain('Tu sesión vence en 1 minuto');
    });

    it('el aviso recuerda que el carrito se conserva', () => {
      setup({ token: createJwt({ expiresInSeconds: 120 }) });

      vi.advanceTimersByTime(40_000);

      expect(notify.warn.mock.calls[0][0]).toContain('el carrito se conserva');
    });

    it('si la sesión dura menos que el margen de aviso, avisa enseguida', () => {
      setup({ token: createJwt({ expiresInSeconds: 45 }) });

      vi.advanceTimersByTime(0);

      expect(notify.warn).toHaveBeenCalledTimes(1);
      expect(notify.warn.mock.calls[0][0]).toContain('menos de un minuto');
    });

    it('avisa una sola vez por sesión', () => {
      setup({ token: createJwt({ expiresInSeconds: 120 }) });

      vi.advanceTimersByTime(110_000);

      expect(notify.warn).toHaveBeenCalledTimes(1);
    });

    it('sin sesión no avisa nada', () => {
      setup();

      vi.advanceTimersByTime(10 * 60_000);

      expect(notify.warn).not.toHaveBeenCalled();
    });

    it('si el usuario cierra sesión antes, cancela el aviso', () => {
      setup({ token: createJwt({ expiresInSeconds: 300 }) });

      auth.endSession('logout');
      TestBed.tick();
      vi.advanceTimersByTime(10 * 60_000);

      expect(notify.warn).not.toHaveBeenCalled();
    });

    it('un login nuevo reprograma el aviso con el nuevo vencimiento', () => {
      setup();
      auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
      http
        .expectOne(`${BASE}/auth/login`)
        .flush({ accessToken: createJwt({ expiresInSeconds: 600 }) });
      TestBed.tick();

      vi.advanceTimersByTime(400_000);
      expect(notify.warn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(120_000);
      expect(notify.warn).toHaveBeenCalledTimes(1);
    });

    it('respeta un margen de aviso configurable', () => {
      setup({ token: createJwt({ expiresInSeconds: 300 }), warnMs: 200_000 });

      vi.advanceTimersByTime(101_000);

      expect(notify.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe('al vencer', () => {
    it('lleva al login indicando que la sesión expiró y la ruta actual', () => {
      setup({ token: createJwt({ expiresInSeconds: 60 }), routerUrl: '/sales/checkout' });

      vi.advanceTimersByTime(61_000);
      TestBed.tick();

      expect(auth.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/sales/checkout', reason: 'expired' },
      });
    });

    it('no redirige si ya está en una pantalla de autenticación', () => {
      setup({ token: createJwt({ expiresInSeconds: 60 }), routerUrl: '/auth/login' });

      vi.advanceTimersByTime(61_000);
      TestBed.tick();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('un cierre de sesión voluntario no redirige (lo hace quien lo pidió)', () => {
      setup({ token: createJwt({ expiresInSeconds: 600 }) });

      auth.endSession('logout');
      TestBed.tick();

      expect(navigate).not.toHaveBeenCalled();
    });

    it('un token que ya estaba vencido al abrir la app no redirige desde acá (lo resuelve el guard)', () => {
      setup({ token: createJwt({ expiresInSeconds: -60 }) });

      TestBed.tick();

      expect(auth.lastEndReason()).toBe('expired');
      expect(navigate).not.toHaveBeenCalled();
    });

    it('tras volver a ingresar y vencer otra vez, vuelve a redirigir', () => {
      setup({ token: createJwt({ expiresInSeconds: 30 }) });
      vi.advanceTimersByTime(31_000);
      TestBed.tick();
      expect(navigate).toHaveBeenCalledTimes(1);

      auth.login({ email: 'a@b.com', password: 'x' }).subscribe();
      http
        .expectOne(`${BASE}/auth/login`)
        .flush({ accessToken: createJwt({ expiresInSeconds: 30 }) });
      TestBed.tick();
      vi.advanceTimersByTime(31_000);
      TestBed.tick();

      expect(navigate).toHaveBeenCalledTimes(2);
    });
  });
});

describe('describeRemaining', () => {
  it('describe el tiempo restante en minutos, redondeando hacia abajo', () => {
    expect(describeRemaining(30_000)).toBe('menos de un minuto');
    expect(describeRemaining(59_999)).toBe('menos de un minuto');
    expect(describeRemaining(60_000)).toBe('1 minuto');
    expect(describeRemaining(119_999)).toBe('1 minuto');
    expect(describeRemaining(120_000)).toBe('2 minutos');
    expect(describeRemaining(5 * 60_000)).toBe('5 minutos');
  });
});
