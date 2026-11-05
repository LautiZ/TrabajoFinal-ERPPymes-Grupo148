import { CanActivateFn, Routes } from '@angular/router';

/**
 * Guards de acceso al módulo de Ventas.
 * TODO(TES-49): sumar el guard de autenticación/roles cuando el módulo Core y Auth lo exponga.
 */
export const SALES_GUARDS: CanActivateFn[] = [];

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
