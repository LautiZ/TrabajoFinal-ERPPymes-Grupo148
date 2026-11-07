import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  NavigationExtras,
  ParamMap,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BehaviorSubject, NEVER, of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { PaginatedResponse } from '../../../../core/models/pagination.model';
import { Product } from '../../models/product.model';
import { InventoryService } from '../../services/inventory.service';
import { createCategory, createProduct } from '../../testing/factories';
import { InventoryList } from './inventory-list';

/** Respuesta con un total grande (hay varias páginas) salvo que la lista sea vacía. */
function pageOf(data: Product[], total = data.length === 0 ? 0 : 100): PaginatedResponse<Product> {
  return { data, meta: { total, page: 1, limit: 10, totalPages: Math.ceil(total / 10) } };
}

describe('InventoryList', () => {
  let params$: BehaviorSubject<ParamMap>;
  let inventory: { list: Mock; listCategories: Mock };
  let fixture: ComponentFixture<InventoryList>;

  const text = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const instance = (): Record<string, (...args: unknown[]) => void> =>
    fixture.componentInstance as unknown as Record<string, (...args: unknown[]) => void>;

  /** Simula lo que haría el router: aplicar los query params a la URL actual. */
  function applyNavigation(_commands: unknown[], extras?: NavigationExtras): Promise<boolean> {
    const current: Record<string, string> = {};
    params$.value.keys.forEach((key) => (current[key] = params$.value.get(key) ?? ''));
    for (const [key, value] of Object.entries(extras?.queryParams ?? {})) {
      if (value === null || value === undefined) {
        delete current[key];
      } else {
        current[key] = String(value);
      }
    }
    params$.next(convertToParamMap(current));
    return Promise.resolve(true);
  }

  async function create(initialParams: Record<string, string> = {}): Promise<void> {
    params$ = new BehaviorSubject(convertToParamMap(initialParams));
    await TestBed.configureTestingModule({
      imports: [InventoryList],
      providers: [
        { provide: InventoryService, useValue: inventory },
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: params$.value },
            queryParamMap: params$.asObservable(),
          },
        },
      ],
    }).compileComponents();
    vi.spyOn(TestBed.inject(Router), 'navigate').mockImplementation(applyNavigation as never);
    fixture = TestBed.createComponent(InventoryList);
    fixture.detectChanges();
  }

  beforeEach(() => {
    inventory = {
      list: vi.fn(() =>
        of(
          pageOf([
            createProduct({
              id: 'p1',
              name: 'Yerba Mate 1kg',
              sku: 'YER-001',
              price: 4500,
              stock: 25,
            }),
            createProduct({
              id: 'p2',
              name: 'Harina a granel',
              sku: 'GRA-HAR-01',
              price: 900,
              stock: 50.5,
              unit: 'Kg',
              active: false,
              category: createCategory({ id: 'c2', name: 'Granos' }),
            }),
          ]),
        ),
      ),
      listCategories: vi.fn(() =>
        of([createCategory(), createCategory({ id: 'c2', name: 'Granos' })]),
      ),
    };
  });

  afterEach(() => vi.useRealTimers());

  it('muestra una fila por producto con nombre, SKU, categoría, precio, stock y estado', async () => {
    await create();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tr.mat-mdc-row');
    expect(rows).toHaveLength(2);
    const first = rows[0].textContent ?? '';
    expect(first).toContain('Yerba Mate 1kg');
    expect(first).toContain('YER-001');
    expect(first).toContain('Almacén');
    expect(first).toContain('4,500.00');
    expect(first).toContain('25 u');
    expect(first).toContain('Activo');
    const second = rows[1].textContent ?? '';
    expect(second).toContain('50.5 kg');
    expect(second).toContain('Pausado');
  });

  it('consulta al backend con los parámetros de la URL', async () => {
    await create({
      page: '2',
      limit: '25',
      search: 'caf',
      sortBy: 'price',
      sortOrder: 'desc',
      categoryId: 'c1',
      stockStatus: 'low',
    });

    expect(inventory.list).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        limit: 25,
        search: 'caf',
        sortBy: 'price',
        sortOrder: 'desc',
        categoryId: 'c1',
        stockStatus: 'low',
        lowStockThreshold: 10,
      }),
    );
    const input = (fixture.nativeElement as HTMLElement).querySelector('input[type=search]');
    expect((input as HTMLInputElement).value).toBe('caf');
  });

  it('muestra el estado de carga mientras espera al backend', async () => {
    inventory.list.mockReturnValue(NEVER);
    await create();

    expect(text()).toContain('Cargando inventario');
  });

  it('muestra el estado vacío cuando no hay productos', async () => {
    inventory.list.mockReturnValue(of(pageOf([])));
    await create();

    expect(text()).toContain('Todavía no hay productos');
  });

  it('con filtros activos y sin resultados ofrece limpiarlos', async () => {
    inventory.list.mockReturnValue(of(pageOf([])));
    await create({ search: 'zzz' });

    expect(text()).toContain('No hay productos que coincidan');
    expect(text()).toContain('Limpiar filtros');
  });

  it('muestra el error y permite reintentar', async () => {
    inventory.list.mockReturnValueOnce(throwError(() => new Error('down')));
    await create();

    expect(text()).toContain('No se pudo cargar el inventario.');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();

    instance()['reload']();
    fixture.detectChanges();

    expect(inventory.list).toHaveBeenCalledTimes(2);
    expect(text()).toContain('Yerba Mate 1kg');
  });

  it('cambiar de página actualiza la URL y vuelve a consultar sin recargar la app', async () => {
    await create();

    instance()['onPage']({ pageIndex: 2, pageSize: 25, length: 80 });
    fixture.detectChanges();

    expect(inventory.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, limit: 25 }),
    );
    expect(params$.value.get('page')).toBe('3');
    expect(params$.value.get('limit')).toBe('25');
  });

  it('ordenar por una columna vuelve a la primera página', async () => {
    await create({ page: '4' });

    instance()['onSort']({ active: 'price', direction: 'desc' });
    fixture.detectChanges();

    expect(inventory.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, sortBy: 'price', sortOrder: 'desc' }),
    );
    expect(params$.value.has('page')).toBe(false);
  });

  it('la búsqueda espera el debounce antes de consultar y vuelve a la primera página', async () => {
    await create({ page: '3' });
    vi.useFakeTimers();
    inventory.list.mockClear();
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type=search]',
    ) as HTMLInputElement;

    input.value = 'caf';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(299);
    expect(inventory.list).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2);
    fixture.detectChanges();

    expect(inventory.list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'caf', page: 1 }),
    );
    expect(params$.value.get('search')).toBe('caf');
  });

  it('los filtros de categoría y de stock actualizan la URL y la consulta', async () => {
    await create({ page: '2' });

    instance()['onCategory']('c2');
    instance()['onStockStatus']('out');
    fixture.detectChanges();

    expect(inventory.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, categoryId: 'c2', stockStatus: 'out' }),
    );
    expect(params$.value.get('categoryId')).toBe('c2');
    expect(params$.value.get('stockStatus')).toBe('out');
  });

  it('limpiar filtros quita búsqueda, categoría y stock pero conserva el orden', async () => {
    await create({ search: 'caf', categoryId: 'c1', stockStatus: 'low', sortBy: 'price' });

    instance()['clearFilters']();
    fixture.detectChanges();

    expect(params$.value.has('search')).toBe(false);
    expect(params$.value.has('categoryId')).toBe(false);
    expect(params$.value.has('stockStatus')).toBe(false);
    expect(params$.value.get('sortBy')).toBe('price');
  });

  it('si la URL cambia (por ejemplo con "atrás") la vista se actualiza', async () => {
    await create();

    params$.next(convertToParamMap({ search: 'valvula', page: '2' }));
    fixture.detectChanges();

    expect(inventory.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'valvula', page: 2 }),
    );
    const input = (fixture.nativeElement as HTMLElement).querySelector(
      'input[type=search]',
    ) as HTMLInputElement;
    expect(input.value).toBe('valvula');
  });

  it('no repite la consulta si la URL cambia a un estado equivalente', async () => {
    await create();
    const calls = inventory.list.mock.calls.length;

    params$.next(convertToParamMap({ page: '1' }));

    expect(inventory.list.mock.calls.length).toBe(calls);
  });

  it('si tras eliminar queda vacía la última página, vuelve a la última que tenga productos', async () => {
    inventory.list.mockReturnValue(
      of({ ...pageOf([]), meta: { total: 12, page: 3, limit: 10, totalPages: 2 } }),
    );
    await create({ page: '3' });

    expect(params$.value.get('page')).toBe('2');
  });

  it('con total 0 no intenta cambiar de página', async () => {
    inventory.list.mockReturnValue(of(pageOf([])));
    await create({ page: '3' });

    expect(params$.value.get('page')).toBe('3');
  });

  it('cada fila tiene su menú de acciones y refrescar vuelve a consultar', async () => {
    await create();

    const menus = (fixture.nativeElement as HTMLElement).querySelectorAll('app-product-actions');
    expect(menus).toHaveLength(2);

    const calls = inventory.list.mock.calls.length;
    instance()['reload']();
    expect(inventory.list.mock.calls.length).toBe(calls + 1);
  });

  it('carga las categorías para el filtro y tolera que fallen', async () => {
    inventory.listCategories.mockReturnValue(throwError(() => new Error('down')));
    await create();

    expect(text()).toContain('Yerba Mate 1kg');
  });

  it('muestra el paginador en español', async () => {
    await create();

    expect(text()).toContain('Por página');
  });
});
