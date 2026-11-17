import { Injectable, InjectionToken, effect, inject, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../shared/services/notification.service';
import { LOGIN_PATH } from '../auth-paths';
import { AuthService } from './auth.service';

/** Cuánto antes del vencimiento se avisa al usuario. */
export const SESSION_WARNING_MS = new InjectionToken<number>('SESSION_WARNING_MS', {
  providedIn: 'root',
  factory: () => 90_000,
});

const MAX_TIMER_MS = 2_000_000_000;

/** Tiempo restante en minutos, redondeado hacia abajo: en un aviso es mejor no exagerar el margen. */
export function describeRemaining(remainingMs: number): string {
  if (remainingMs < 60_000) {
    return 'menos de un minuto';
  }
  const minutes = Math.floor(remainingMs / 60_000);
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

/**
 * Acompaña la expiración de la sesión (el access token es de vida corta y no hay refresh token):
 * avisa unos instantes antes de que venza y, al vencer, lleva al login con el motivo y la ruta
 * actual (`returnUrl`). El cierre de la sesión en sí lo hace `AuthService`. El carrito vive en
 * su propio almacenamiento y no se borra al cerrar sesión, así que se conserva al volver a entrar.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionExpiryService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly warnBefore = inject(SESSION_WARNING_MS);

  private wasAuthenticated = this.auth.isAuthenticated();

  constructor() {
    // Aviso previo: se reprograma cada vez que cambia el vencimiento (login nuevo) y se cancela al cerrar sesión.
    effect((onCleanup) => {
      const expiresAt = this.auth.expiresAt();
      if (expiresAt === null) {
        return;
      }
      const delay = Math.max(0, expiresAt - this.warnBefore - Date.now());
      const timer = setTimeout(() => this.warn(expiresAt), Math.min(delay, MAX_TIMER_MS));
      onCleanup(() => clearTimeout(timer));
    });

    // Vencimiento mientras la app está abierta: ir al login explicando por qué.
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      const reason = this.auth.lastEndReason();
      untracked(() => {
        if (this.wasAuthenticated && !authenticated && reason === 'expired') {
          this.redirectToLogin();
        }
        this.wasAuthenticated = authenticated;
      });
    });
  }

  private warn(expiresAt: number): void {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0 || !this.auth.isAuthenticated()) {
      return;
    }
    this.notify.warn(
      `Tu sesión vence en ${describeRemaining(remaining)}. Guardá o terminá la venta en curso: ` +
        'el carrito se conserva al volver a ingresar.',
    );
  }

  private redirectToLogin(): void {
    const current = this.router.url;
    if (current.startsWith('/auth')) {
      return;
    }
    void this.router.navigate([LOGIN_PATH], {
      queryParams: { returnUrl: current, reason: 'expired' },
    });
  }
}
