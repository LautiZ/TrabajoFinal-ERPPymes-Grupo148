import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Route, Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes as appRoutes } from '../../app.routes';
import { authGuard, roleGuard } from '../../core/guards/auth.guard';
import { NotificationService } from '../../shared/services/notification.service';
import { INVENTORY_ROUTES } from './inventory.routes';
import { InventoryService } from './services/inventory.service';
import { StockSummaryService } from './services/stock-summary.service';
import { INVENTORY_WRITE_ROLES } from './utils/inventory-roles';

@Component({ template: 'stub' })
class Stub {}

/** Aplana el árbol de rutas con su ruta completa para poder buscarlas por path. */
function flatten(routes: readonly Route[], prefix = ''): Map<string, Route> {
  const result = new Map<string, Route>();
  for (const route of routes) {
    const full = [prefix, route.path ?? ''].filter(Boolean).join('/');
    result.set(full, route);
    if (route.children) {
      flatten(route.children, full).forEach((value, key) => result.set(key, value));
    }
  }
  return result;
}

describe('INVENTORY_ROUTES', () => {
  describe('definición', () => {
    const tree = flatten(INVENTORY_ROUTES);

    it('el módulo exige sesión en todas sus rutas', () => {
      expect(INVENTORY_ROUTES[0].canActivate).toEqual([authGuard]);
    });

    it('define lista, alta y edición con carga diferida de cada pantalla', () => {
      const list = [...tree.values()].filter((r) => r.path === '');
      const create = tree.get('new');
      const edit = tree.get(':id/edit');

      expect(list.some((r) => typeof r.loadComponent === 'function')).toBe(true);
      expect(typeof create?.loadComponent).toBe('function');
      expect(typeof edit?.loadComponent).toBe('function');
      expect([...tree.values()].every((r) => !r.component)).toBe(true);
    });

    it('crear y editar exigen un rol autorizado', () => {
      for (const path of ['new', ':id/edit']) {
        const route = tree.get(path);
        expect(route?.canActivate).toEqual([roleGuard]);
        expect(route?.data?.['roles']).toEqual([...INVENTORY_WRITE_ROLES]);
      }
    });

    it('cada ruta tiene un título', () => {
      expect(tree.get('new')?.title).toBe('Nuevo producto');
      expect(tree.get(':id/edit')?.title).toBe('Editar producto');
    });
  });

  describe('carga diferida en la aplicación', () => {
    it('`/inventory` se carga con loadChildren, no se incluye en el bundle inicial', () => {
      const shell = appRoutes.find((r) => r.children && r.loadComponent);
      const inventory = shell?.children?.find((r) => r.path === 'inventory');

      expect(typeof inventory?.loadChildren).toBe('function');
      expect(inventory?.component).toBeUndefined();
      expect(inventory?.loadComponent).toBeUndefined();
    });

    it('el módulo cargado entrega las mismas rutas', async () => {
      const shell = appRoutes.find((r) => r.children && r.loadComponent);
      const inventory = shell?.children?.find((r) => r.path === 'inventory');

      const loaded = await (inventory?.loadChildren as () => Promise<unknown>)();

      expect(loaded).toBe(INVENTORY_ROUTES);
    });
  });

  describe('navegación y guards', () => {
    let harness: RouterTestingHarness;

    async function setup(): Promise<void> {
      TestBed.configureTestingModule({
        providers: [
          provideRouter([
            { path: 'inventory', children: INVENTORY_ROUTES },
            { path: 'dashboard', component: Stub },
            { path: 'auth/login', component: Stub },
          ]),
          {
            provide: InventoryService,
            useValue: {
              list: () => of({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }),
              listCategories: () => of([]),
            },
          },
          {
            provide: StockSummaryService,
            useValue: { load: () => of({ total: 0, ok: 0, low: 0, out: 0 }) },
          },
          { provide: NotificationService, useValue: { success: vi.fn(), error: vi.fn() } },
        ],
      });
      harness = await RouterTestingHarness.create();
    }

    const url = (): string => TestBed.inject(Router).url;

    afterEach(() => {
      localStorage.removeItem('user_role');
      localStorage.removeItem('is_authenticated');
    });

    it('con sesión, `/inventory` muestra el listado', async () => {
      await setup();

      await harness.navigateByUrl('/inventory');

      expect(url()).toBe('/inventory');
      expect((harness.routeNativeElement as HTMLElement).textContent).toContain(
        'Inventario & Stock',
      );
    });

    it('sin sesión redirige al login', async () => {
      localStorage.setItem('is_authenticated', 'false');
      await setup();

      await harness.navigateByUrl('/inventory');

      expect(url()).toBe('/auth/login');
    });

    it('un rol autorizado accede al alta de producto', async () => {
      localStorage.setItem('user_role', 'ADMIN');
      await setup();

      await harness.navigateByUrl('/inventory/new');

      expect(url()).toBe('/inventory/new');
      expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Nuevo producto');
    });

    it('un rol no autorizado no accede al alta ni a la edición: vuelve al panel', async () => {
      localStorage.setItem('user_role', 'INVITADO');
      await setup();

      await harness.navigateByUrl('/inventory/new');
      expect(url()).toBe('/dashboard');

      await harness.navigateByUrl('/inventory/p1/edit');
      expect(url()).toBe('/dashboard');
    });

    it('un rol no autorizado igual puede ver el listado', async () => {
      localStorage.setItem('user_role', 'INVITADO');
      await setup();

      await harness.navigateByUrl('/inventory');

      expect(url()).toBe('/inventory');
    });
  });
});
