import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

export type UserRole = 'ADMIN' | 'VENDEDOR' | string;

/**
 * Obtiene el rol del usuario actual desde localStorage ('user_role' o objeto 'user').
 * Mientras TES-49 no esté integrado, devuelve 'ADMIN' por defecto si no hay sesión
 * para permitir el desarrollo local del módulo.
 */
export function getCurrentUserRole(): UserRole {
  if (typeof window === 'undefined') {
    return 'ADMIN';
  }

  const directRole = localStorage.getItem('user_role');
  if (directRole) {
    return directRole;
  }

  const rawUser = localStorage.getItem('user');
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as { role?: string; rol?: string };
      return parsed.role ?? parsed.rol ?? 'ADMIN';
    } catch {
      return 'ADMIN';
    }
  }

  return 'ADMIN';
}

export const authGuard: CanActivateFn = () => {
  const router = inject(Router);
  if (typeof window !== 'undefined' && localStorage.getItem('is_authenticated') === 'false') {
    return router.createUrlTree(['/auth/login']);
  }
  return true;
};

export const roleGuard: CanActivateFn = (route) => {
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];

  if (allowedRoles.length === 0) {
    return true;
  }

  const userRole = getCurrentUserRole();
  if (allowedRoles.includes(userRole)) {
    return true;
  }

  // Si un VENDEDOR intenta entrar por URL a /analytics, redirige a /dashboard
  return router.createUrlTree(['/dashboard']);
};