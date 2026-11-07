import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';
import { INVENTORY_WRITE_ROLES } from './utils/inventory-roles';

/**
 * Rutas del módulo de Inventario, cargadas con lazy loading bajo `/inventory`.
 * Todo el módulo exige sesión; crear y editar además exigen un rol autorizado.
 */
export const INVENTORY_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        title: 'Inventario',
        loadComponent: () =>
          import('./pages/inventory-list/inventory-list').then((m) => m.InventoryList),
      },
      {
        path: 'new',
        title: 'Nuevo producto',
        canActivate: [roleGuard],
        data: { roles: [...INVENTORY_WRITE_ROLES] },
        loadComponent: () => import('./pages/product-form/product-form').then((m) => m.ProductForm),
      },
      {
        path: ':id/edit',
        title: 'Editar producto',
        canActivate: [roleGuard],
        data: { roles: [...INVENTORY_WRITE_ROLES] },
        loadComponent: () => import('./pages/product-form/product-form').then((m) => m.ProductForm),
      },
    ],
  },
];
