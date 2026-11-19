import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    // Mercado Pago devuelve al comprador a /payments/success|failure|pending (URLs que arma el backend).
    // Se reenvía a la pantalla de resultado del módulo de ventas conservando los parámetros de retorno.
    path: 'payments/:result',
    redirectTo: 'sales/payment/:result',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    // Aplicación autenticada: todo lo que cuelga del shell exige sesión.
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'inventory',
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.INVENTORY_ROUTES),
      },
      {
        path: 'sales',
        loadChildren: () => import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
      },
      {
        path: 'analytics',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['Owner', 'Admin'] },
        loadChildren: () =>
          import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./features/auth/pages/access-denied/access-denied').then((m) => m.AccessDenied),
      },
      {
        path: 'ui-demo',
        loadComponent: () => import('./features/ui-demo/ui-demo').then((m) => m.UiDemo),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
