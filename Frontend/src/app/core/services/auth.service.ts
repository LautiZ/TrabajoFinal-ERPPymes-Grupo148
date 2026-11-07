import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of } from 'rxjs';
import {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  SessionEndReason,
  UserRole,
} from '../models/auth.model';
import { decodeJwt, expiresAtMs, isExpired, toAuthUser } from '../utils/jwt';
import { ApiService } from './api.service';
import { TokenStorageService } from './token-storage.service';

export const AUTH_ENDPOINTS = {
  login: 'auth/login',
  register: 'auth/register',
  logout: 'auth/logout',
} as const;

/** Login y registro: no llevan token y un 401 acá significa "credenciales inválidas". */
export function isPublicAuthUrl(url: string): boolean {
  return /\/auth\/(login|register)(\?|#|$)/.test(url);
}

/** Cualquier endpoint de autenticación (login, registro y logout). */
export function isAuthUrl(url: string): boolean {
  return /\/auth\/(login|register|logout)(\?|#|$)/.test(url);
}

/** Respuesta de login: se acepta `accessToken`, `access_token` o `token`. */
interface LoginResponse {
  accessToken?: string;
  access_token?: string;
  token?: string;
}

interface Session {
  user: AuthUser;
  /** Vencimiento del token, en milisegundos desde epoch. */
  expiresAt: number;
}

/** `setTimeout` no admite demoras mayores a ~24,8 días: se reprograma en tramos. */
const MAX_TIMER_MS = 2_000_000_000;

/**
 * Estado de sesión del cliente. Guarda el JWT solo a través de `TokenStorageService`, lo
 * restaura al recargar y cierra la sesión sola cuando el token vence.
 *
 * Es para la UX (qué mostrar, adónde redirigir); la seguridad real la aplica el Guard JWT del
 * Gateway en cada request.
 */
@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly tokens = inject(TokenStorageService);

  private readonly session = signal<Session | null>(null);
  private readonly _lastEndReason = signal<SessionEndReason | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly currentUser = computed(() => this.session()?.user ?? null);
  readonly role = computed<UserRole | null>(() => this.session()?.user.role ?? null);
  readonly roles = computed<readonly UserRole[]>(() => {
    const role = this.role();
    return role ? [role] : [];
  });
  /** Vencimiento de la sesión (ms desde epoch), o `null` si no hay sesión. */
  readonly expiresAt = computed(() => this.session()?.expiresAt ?? null);
  /** Motivo por el que terminó la última sesión; se borra al iniciar una nueva. */
  readonly lastEndReason = this._lastEndReason.asReadonly();

  constructor() {
    this.restore();
  }

  /** Inicia sesión con email y contraseña y deja la sesión activa. */
  login(credentials: LoginRequest): Observable<AuthUser> {
    return this.api
      .post<LoginResponse>(AUTH_ENDPOINTS.login, credentials)
      .pipe(map((response) => this.startSession(readToken(response))));
  }

  /** Registro público de arranque (RN-16.4). No inicia sesión. */
  register(data: RegisterRequest): Observable<void> {
    return this.api.post<unknown>(AUTH_ENDPOINTS.register, data).pipe(map(() => undefined));
  }

  /**
   * Revoca la sesión en el servidor y luego limpia el estado local, aunque la llamada falle.
   * El estado local se limpia al terminar la llamada (o si se cancela la suscripción).
   */
  logout(): Observable<void> {
    const revoke$ = this.isSessionActive()
      ? this.api.post<unknown>(AUTH_ENDPOINTS.logout, {}).pipe(
          map(() => undefined),
          catchError(() => of(undefined)),
        )
      : of(undefined);
    return revoke$.pipe(finalize(() => this.endSession('logout')));
  }

  /** Termina la sesión localmente (sin llamar al servidor) y registra el motivo. */
  endSession(reason: SessionEndReason): void {
    const hadSession = this.session() !== null || this.tokens.get() !== null;
    this.clearTimer();
    this.tokens.clear();
    this.session.set(null);
    if (hadSession) {
      this._lastEndReason.set(reason);
    }
  }

  /**
   * `true` si hay una sesión vigente. Revisa el vencimiento contra el reloj en el momento de
   * la consulta (no depende de que el temporizador ya haya disparado) y cierra la sesión si venció.
   */
  isSessionActive(): boolean {
    const session = this.session();
    if (!session) {
      return false;
    }
    if (isExpired(session.expiresAt)) {
      this.endSession('expired');
      return false;
    }
    return true;
  }

  /** Token listo para enviar al Gateway; `null` si no hay sesión o ya venció (nunca se envía uno vencido). */
  validToken(): string | null {
    return this.isSessionActive() ? this.tokens.get() : null;
  }

  hasRole(...roles: readonly UserRole[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  private startSession(token: string): AuthUser {
    const payload = decodeJwt(token);
    if (!payload) {
      throw new Error('La respuesta de autenticación no es válida.');
    }
    const expiresAt = expiresAtMs(payload);
    if (isExpired(expiresAt)) {
      throw new Error('El servidor devolvió una sesión que ya venció.');
    }

    const user = toAuthUser(payload);
    this.tokens.set(token);
    this.session.set({ user, expiresAt });
    this._lastEndReason.set(null);
    this.scheduleExpiry(expiresAt);
    return user;
  }

  /** Restaura la sesión guardada; un token inválido o vencido se descarta. */
  private restore(): void {
    const token = this.tokens.get();
    if (!token) {
      return;
    }
    const payload = decodeJwt(token);
    if (!payload) {
      this.tokens.clear();
      return;
    }
    const expiresAt = expiresAtMs(payload);
    if (isExpired(expiresAt)) {
      this.tokens.clear();
      this._lastEndReason.set('expired');
      return;
    }
    this.session.set({ user: toAuthUser(payload), expiresAt });
    this.scheduleExpiry(expiresAt);
  }

  private scheduleExpiry(expiresAt: number): void {
    this.clearTimer();
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      this.endSession('expired');
      return;
    }
    this.expiryTimer = setTimeout(
      () => {
        this.expiryTimer = undefined;
        if (isExpired(expiresAt)) {
          this.endSession('expired');
        } else {
          this.scheduleExpiry(expiresAt);
        }
      },
      Math.min(delay, MAX_TIMER_MS),
    );
  }

  private clearTimer(): void {
    if (this.expiryTimer !== undefined) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = undefined;
    }
  }
}

function readToken(response: LoginResponse): string {
  const token = response.accessToken ?? response.access_token ?? response.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('El servidor no devolvió un token de acceso.');
  }
  return token;
}
