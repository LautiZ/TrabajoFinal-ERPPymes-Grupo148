import { Routes } from '@angular/router';

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
    path: 'inventory',
    loadComponent: () =>
      import('./features/inventory/pages/inventory-list/inventory-list').then(
        (m) => m.InventoryList,
      ),
  },
  {
    path: 'sales',
    loadComponent: () => import('./features/sales/pages/pos/pos').then((m) => m.Pos),
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
  },
];
