import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Route,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { routes } from '../app.routes';
import { INVENTORY_ROUTES } from '../features/inventory/inventory.routes';
import { SALES_ROUTES } from '../features/sales/sales.routes';
import { UserRole } from './models/auth.model';
import { TOKEN_STORAGE, TOKEN_STORAGE_KEY } from './services/token-storage.service';
import { createJwt } from './testing/jwt';
import { createMemoryStorage } from './testing/storage';

/**
 * Matriz de permisos del frontend contra las reglas de negocio (RN-16, RN-16.2, RN-16.3):
 * qué pantallas abre cada rol. Corre los guards reales de las rutas reales. Es UX: el Gateway
 * valida el rol de nuevo en cada request.
 */
const ROLES: readonly UserRole[] = ['Owner', 'Admin', 'Employee'];

/** Rutas del shell (`''` autenticado) y sus guards, con el rol esperado de cada pantalla. */
function shellChildren(): readonly Route[] {
  const shell = routes.find((r) => r.path === '' && r.children);
  return shell?.children ?? [];
}

function find(list: readonly Route[], path: string): Route {
  const route = list.find((r) => r.path === path);
  if (!route) {
    throw new Error(`Ruta no encontrada: ${path}`);
  }
  return route;
}

describe('matriz de permisos por rol', () => {
  let router: Router;

  function login(role: UserRole): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: TOKEN_STORAGE,
          useValue: createMemoryStorage({ [TOKEN_STORAGE_KEY]: createJwt({ role }) }),
        },
      ],
    });
    router = TestBed.inject(Router);
  }

  /** Aplica en orden los guards de la cadena de rutas; `true` si el rol llega a la pantalla. */
  function canOpen(chain: readonly Route[], url: string): boolean {
    for (const route of chain) {
      for (const guard of route.canActivate ?? []) {
        const snapshot = { data: route.data ?? {} } as unknown as ActivatedRouteSnapshot;
        const state = { url } as RouterStateSnapshot;
        const result = TestBed.runInInjectionContext(() =>
          (guard as CanActivateFn)(snapshot, state),
        ) as boolean | UrlTree;
        if (result !== true) {
          return false;
        }
      }
    }
    return true;
  }

  const inventoryRoot = INVENTORY_ROUTES[0];
  const inventoryChild = (path: string): Route => find(inventoryRoot.children ?? [], path);
  const salesRoot = SALES_ROUTES[0];
  const salesChild = (path: string): Route => find(salesRoot.children ?? [], path);

  /** pantalla -> cadena de rutas -> quién entra (Owner, Admin, Employee). */
  const matrix: readonly {
    screen: string;
    url: string;
    chain: () => readonly Route[];
    allowed: Record<UserRole, boolean>;
  }[] = [
    {
      screen: 'Panel principal',
      url: '/dashboard',
      chain: () => [find(shellChildren(), 'dashboard')],
      allowed: { Owner: true, Admin: true, Employee: false },
    },
    {
      screen: 'Analítica',
      url: '/analytics',
      chain: () => [find(shellChildren(), 'analytics')],
      allowed: { Owner: true, Admin: true, Employee: false },
    },
    {
      screen: 'Crear usuario',
      url: '/users/new',
      chain: () => [find(shellChildren(), 'users/new')],
      allowed: { Owner: true, Admin: true, Employee: false },
    },
    {
      screen: 'Inventario (listado)',
      url: '/inventory',
      chain: () => [inventoryRoot, inventoryChild('')],
      allowed: { Owner: true, Admin: true, Employee: true },
    },
    {
      screen: 'Inventario (alta de producto)',
      url: '/inventory/new',
      chain: () => [inventoryRoot, inventoryChild('new')],
      allowed: { Owner: true, Admin: true, Employee: true },
    },
    {
      screen: 'Inventario (editar producto)',
      url: '/inventory/p1/edit',
      chain: () => [inventoryRoot, inventoryChild(':id/edit')],
      allowed: { Owner: true, Admin: true, Employee: true },
    },
    {
      screen: 'Punto de venta',
      url: '/sales',
      chain: () => [salesRoot, salesChild('')],
      allowed: { Owner: true, Admin: true, Employee: true },
    },
    {
      screen: 'Cobro (checkout)',
      url: '/sales/checkout',
      chain: () => [salesRoot, salesChild('checkout')],
      allowed: { Owner: true, Admin: true, Employee: true },
    },
    {
      screen: 'Resultado del pago',
      url: '/sales/payment/success',
      chain: () => [salesRoot, salesChild('payment/:result')],
      allowed: { Owner: true, Admin: true, Employee: true },
    },
  ];

  for (const role of ROLES) {
    describe(`como ${role}`, () => {
      for (const entry of matrix) {
        const expected = entry.allowed[role];
        it(`${expected ? 'puede abrir' : 'NO puede abrir'}: ${entry.screen}`, () => {
          login(role);

          expect(canOpen(entry.chain(), entry.url)).toBe(expected);
        });
      }
    });
  }

  it('el Employee que pide el panel principal termina en Ventas, no en un error', () => {
    login('Employee');
    const dashboard = find(shellChildren(), 'dashboard');
    const guard = (dashboard.canActivate ?? [])[0] as CanActivateFn;

    const result = TestBed.runInInjectionContext(() =>
      guard(
        { data: {} } as unknown as ActivatedRouteSnapshot,
        {
          url: '/dashboard',
        } as RouterStateSnapshot,
      ),
    ) as UrlTree;

    expect(router.serializeUrl(result)).toBe('/sales');
  });
});
