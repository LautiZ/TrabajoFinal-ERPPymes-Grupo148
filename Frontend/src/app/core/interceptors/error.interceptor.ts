import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../../shared/services/notification.service';
import { API_URL } from '../services/api.service';
import { AuthService, isAuthUrl } from '../services/auth.service';
import { isGatewayUrl } from './auth.interceptor';

export const LOGIN_PATH = '/auth/login';

/**
 * Traduce los errores HTTP del Gateway a mensajes amigables y reacciona a los de acceso:
 * - `401`: la sesión ya no es válida → se limpia y se lleva al usuario al login con `returnUrl`.
 * - `403`: informa la falta de permisos.
 * - sin conexión (`0`) y `5xx`: informa el problema.
 *
 * Los demás errores (400, 404, 409…) no se notifican acá: cada pantalla los muestra en contexto.
 * Los endpoints de autenticación quedan fuera: un 401 en el login significa "credenciales
 * inválidas" y lo muestra el formulario. El error siempre se vuelve a lanzar.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const apiUrl = inject(API_URL);
  const notify = inject(NotificationService);
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        isGatewayUrl(req.url, apiUrl) &&
        !isAuthUrl(req.url)
      ) {
        handle(error.status);
      }
      return throwError(() => error);
    }),
  );

  function handle(status: number): void {
    if (status === 401) {
      auth.endSession('unauthorized');
      notify.error('Tu sesión no es válida o expiró. Ingresá de nuevo.');
      const current = router.url;
      if (!current.startsWith('/auth')) {
        void router.navigate([LOGIN_PATH], {
          queryParams: { returnUrl: current, reason: 'unauthorized' },
        });
      }
    } else if (status === 403) {
      notify.error('No tenés permisos para realizar esta acción.');
    } else if (status === 0) {
      notify.error('No hay conexión con el servidor. Revisá tu red e intentá de nuevo.');
    } else if (status >= 500) {
      notify.error('El servidor tuvo un problema. Intentá de nuevo en unos minutos.');
    }
  }
};
