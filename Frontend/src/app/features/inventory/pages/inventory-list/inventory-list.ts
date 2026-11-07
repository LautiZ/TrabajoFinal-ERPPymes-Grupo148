import { CurrencyPipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Subject,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import {
  Category,
  Product,
  ProductSortField,
  ProductUnit,
  StockStatusFilter,
  UNIT_SYMBOLS,
} from '../../models/product.model';
import { InventoryService } from '../../services/inventory.service';
import {
  DEFAULT_LIST_STATE,
  ListState,
  PAGE_SIZE_OPTIONS,
  hasActiveFilters,
  parseListState,
  toListQuery,
  toQueryParams,
} from '../../utils/inventory-query';
import { createSpanishPaginatorIntl } from '../../utils/paginator-intl';
import { DEFAULT_LOW_STOCK_THRESHOLD } from '../../utils/stock-status';

const SEARCH_DEBOUNCE_MS = 300;

@Component({
  imports: [
    CurrencyPipe,
    DecimalPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatSortModule,
    MatTableModule,
    PageHeader,
    EmptyState,
    LoadingSpinner,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: createSpanishPaginatorIntl }],
  selector: 'app-inventory-list',
  styleUrl: './inventory-list.scss',
  templateUrl: './inventory-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryList {
  private readonly inventory = inject(InventoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly displayedColumns = [
    'product',
    'category',
    'price',
    'stock',
    'status',
    'actions',
  ];
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  protected readonly search = new FormControl('', { nonNullable: true });

  /** Estado de la vista: la fuente de verdad es la URL (query params). */
  protected readonly state = signal<ListState>(parseListState(this.route.snapshot.queryParamMap));
  protected readonly products = signal<Product[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly categories = signal<Category[]>([]);

  protected readonly filtersActive = computed(() => hasActiveFilters(this.state()));

  constructor() {
    this.search.setValue(this.state().search, { emitEvent: false });

    this.inventory
      .listCategories()
      .pipe(
        catchError(() => of([] as Category[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((categories) => this.categories.set(categories));

    // URL -> estado de la vista
    this.route.queryParamMap
      .pipe(map(parseListState), takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.state.set(state);
        if (this.search.value.trim() !== state.search) {
          this.search.setValue(state.search, { emitEvent: false });
        }
      });

    // Búsqueda con debounce -> URL
    this.search.valueChanges
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((value) => value.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((value) => {
        if (value !== this.state().search) {
          this.update({ search: value });
        }
      });

    // Estado (o pedido de recarga) -> datos del backend
    combineLatest([
      this.route.queryParamMap.pipe(
        map(parseListState),
        distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      ),
      this.reload$.pipe(startWith(undefined)),
    ])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap(([state]) =>
          this.inventory.list(toListQuery(state, this.lowStockThreshold())).pipe(
            catchError(() => {
              this.error.set('No se pudo cargar el inventario.');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        if (response) {
          this.products.set(response.data);
          this.total.set(response.meta.total);
        } else {
          this.products.set([]);
          this.total.set(0);
        }
        this.loading.set(false);
      });
  }

  protected unitSymbol(unit: ProductUnit): string {
    return UNIT_SYMBOLS[unit];
  }

  /** Umbral de "stock bajo" con el que se consulta al backend. */
  protected lowStockThreshold(): number {
    return DEFAULT_LOW_STOCK_THRESHOLD;
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected onPage(event: PageEvent): void {
    this.update({ page: event.pageIndex + 1, limit: event.pageSize }, false);
  }

  protected onSort(sort: Sort): void {
    if (!sort.direction) {
      return;
    }
    this.update({ sortBy: sort.active as ProductSortField, sortOrder: sort.direction });
  }

  protected onCategory(categoryId: string): void {
    this.update({ categoryId });
  }

  protected onStockStatus(stockStatus: StockStatusFilter | ''): void {
    this.update({ stockStatus });
  }

  protected clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.update({ search: '', categoryId: '', stockStatus: '' });
  }

  /**
   * Cambia parte del estado reflejándolo en la URL. Salvo que se indique lo contrario,
   * volver a la primera página (un filtro o un orden nuevo invalida la página actual).
   */
  protected update(patch: Partial<ListState>, resetPage = true): void {
    const next: ListState = {
      ...this.state(),
      ...(resetPage ? { page: DEFAULT_LIST_STATE.page } : {}),
      ...patch,
    };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: toQueryParams(next),
      queryParamsHandling: 'merge',
    });
  }
}
