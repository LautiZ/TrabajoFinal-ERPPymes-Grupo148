import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { EMPLOYEE_HOME_PATH, FORBIDDEN_PATH, HOME_PATH, LOGIN_PATH } from '../auth-paths';
import { UserRole } from '../models/auth.model';
import { AuthService } from '../services/auth.service';

/*
 * IMPORTANTE: estos guards son UX, no seguridad. Evitan mostrar pantallas a quien no
 * corresponde y llevan al usuario al lugar correcto, pero cualquiera puede alterar el código
 * del navegador. La seguridad real la aplica el Guard JWT del Gateway (TES-33) en cada request.
 */

function toLogin(router: Router, returnUrl: string, expired: boolean): UrlTree {
  const queryParams: Record<string, string> = {};
  if (returnUrl && returnUrl !== '/') {
    queryParams['returnUrl'] = returnUrl;
  }
  if (expired) {
    queryParams['reason'] = 'expired';
  }
  return router.createUrlTree([LOGIN_PATH], { queryParams });
}

/** Bloquea las rutas privadas sin sesión válida y manda al login recordando a dónde iba (`returnUrl`). */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  if (auth.isSessionActive()) {
    return true;
  }
  return toLogin(inject(Router), state.url, auth.lastEndReason() === 'expired');
};

/**
 * Restringe la ruta a los roles indicados en `data: { roles: [...] }`. Sin sesión va al login;
 * con sesión pero sin el rol, a la página de acceso denegado. Una ruta sin `roles` solo exige sesión.
 */
export const roleGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSessionActive()) {
    return toLogin(router, state.url, auth.lastEndReason() === 'expired');
  }

  const allowed = (route.data['roles'] as readonly UserRole[] | undefined) ?? [];
  return allowed.length === 0 || auth.hasRole(...allowed)
    ? true
    : router.createUrlTree([FORBIDDEN_PATH]);
};

/**
 * Panel principal (`/dashboard`): sus datos salen de la analítica, que es solo para `Owner` y
 * `Admin`. Un `Employee` que llega acá (login, link guardado, escribir la URL) va directo a su
 * pantalla de trabajo en vez de ver un panel que no puede cargar.
 */
export const dashboardGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isSessionActive()) {
    return toLogin(router, state.url, auth.lastEndReason() === 'expired');
  }
  return auth.hasRole('Owner', 'Admin') ? true : router.createUrlTree([EMPLOYEE_HOME_PATH]);
};

/** Evita que un usuario con sesión vuelva a las pantallas de login o registro. */
export const guestGuard: CanActivateFn = () => {
  return inject(AuthService).isSessionActive() ? inject(Router).createUrlTree([HOME_PATH]) : true;
};
