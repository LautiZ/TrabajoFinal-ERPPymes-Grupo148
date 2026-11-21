import { Routes } from '@angular/router';
import { authGuard, dashboardGuard, guestGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    // Mercado Pago devuelve al comprador a /payments/success|failure|pending (URLs que arma el
    // backend). El comprador no tiene sesión: es una pantalla pública y solo informativa.
    // El estado real del pago lo ve el comercio en /sales/payment/:result.
    path: 'payments/:result',
    title: 'Gracias por su compra',
    loadComponent: () =>
      import('./features/public/pages/thank-you/thank-you').then((m) => m.ThankYou),
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
        title: 'Panel Principal',
        canActivate: [dashboardGuard],
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
        title: 'Analítica',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['Owner', 'Admin'] },
        loadChildren: () =>
          import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
      },
      {
        // Alta de usuarios: Owner crea Admin/Employee; Admin crea Employee (RN-16).
        path: 'users/new',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['Owner', 'Admin'] },
        loadComponent: () =>
          import('./features/users/pages/user-create/user-create').then((m) => m.UserCreate),
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
