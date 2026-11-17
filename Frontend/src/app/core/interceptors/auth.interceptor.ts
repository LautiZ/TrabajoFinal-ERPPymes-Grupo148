import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_URL } from '../services/api.service';
import { AuthService, isPublicAuthUrl } from '../services/auth.service';

/** `true` si la URL apunta al API Gateway (la única dirección a la que se envía el token). */
export function isGatewayUrl(url: string, apiUrl: string): boolean {
  const base = apiUrl.replace(/\/+$/, '');
  return url === base || url.startsWith(`${base}/`);
}

/**
 * Agrega `Authorization: Bearer <token>` a las requests dirigidas al Gateway, para que ningún
 * servicio tenga que hacerlo a mano. Nunca envía el token a otros orígenes, a login/registro,
 * ni un token vencido.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (
    !isGatewayUrl(req.url, inject(API_URL)) ||
    isPublicAuthUrl(req.url) ||
    req.headers.has('Authorization')
  ) {
    return next(req);
  }

  const token = inject(AuthService).validToken();
  return token ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })) : next(req);
};
