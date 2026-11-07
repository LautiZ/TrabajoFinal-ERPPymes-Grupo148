import { CanActivateFn, Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

/**
 * Guards de acceso al módulo de Ventas: exige sesión. El módulo no restringe por rol: cualquier
 * usuario autenticado puede operar el punto de venta.
 */
export const SALES_GUARDS: CanActivateFn[] = [authGuard];

/** Rutas del módulo, cargadas con lazy loading bajo `/sales`. */
export const SALES_ROUTES: Routes = [
  {
    path: '',
    canActivate: SALES_GUARDS,
    children: [
      {
        path: '',
        title: 'Punto de venta',
        loadComponent: () => import('./pages/pos/pos').then((m) => m.Pos),
      },
      {
        path: 'checkout',
        title: 'Cobrar venta',
        loadComponent: () => import('./pages/checkout/checkout').then((m) => m.Checkout),
      },
      {
        path: 'payment/:result',
        title: 'Resultado del pago',
        loadComponent: () =>
          import('./pages/payment-result/payment-result').then((m) => m.PaymentResult),
      },
    ],
  },
];
