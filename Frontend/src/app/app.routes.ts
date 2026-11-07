import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';
import { INVENTORY_WRITE_ROLES } from './features/inventory/utils/inventory-roles';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./core/layout/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'inventory',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/inventory/pages/inventory-list/inventory-list').then(
                (m) => m.InventoryList,
              ),
          },
          {
            path: 'new',
            canActivate: [authGuard, roleGuard],
            data: { roles: [...INVENTORY_WRITE_ROLES] },
            loadComponent: () =>
              import('./features/inventory/pages/product-form/product-form').then(
                (m) => m.ProductForm,
              ),
          },
          {
            path: ':id/edit',
            canActivate: [authGuard, roleGuard],
            data: { roles: [...INVENTORY_WRITE_ROLES] },
            loadComponent: () =>
              import('./features/inventory/pages/product-form/product-form').then(
                (m) => m.ProductForm,
              ),
          },
        ],
      },
      {
        path: 'sales',
        loadChildren: () => import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
      },
      {
        path: 'analytics',
        canActivate: [authGuard, roleGuard],
        data: { roles: ['ADMIN'] },
        loadChildren: () =>
          import('./features/analytics/analytics.routes').then((m) => m.ANALYTICS_ROUTES),
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
