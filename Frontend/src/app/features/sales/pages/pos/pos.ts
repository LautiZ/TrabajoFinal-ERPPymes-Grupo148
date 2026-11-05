import { CurrencyPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  ElementRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  merge,
  of,
  startWith,
  switchMap,
  tap,
} from 'rxjs';
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { NotificationService } from '../../../../shared/services/notification.service';
import { CartView } from '../../components/cart-view/cart-view';
import { CatalogProduct, UNIT_LABELS } from '../../models/product.model';
import { CartService } from '../../services/cart.service';
import { CatalogService } from '../../services/catalog.service';
import { describeCartError } from '../../utils/cart-messages';

const PAGE_SIZE = 24;
const SEARCH_DEBOUNCE_MS = 250;

@Component({
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    LoadingSpinner,
    PageHeader,
    CartView,
  ],
  selector: 'app-pos',
  styleUrl: './pos.scss',
  templateUrl: './pos.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pos {
  private readonly catalog = inject(CatalogService);
  private readonly cart = inject(CartService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly products = signal<CatalogProduct[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  /** Cantidad ya cargada en el carrito por producto, para mostrar el stock restante. */
  protected readonly inCart = computed(
    () => new Map(this.cart.items().map((item) => [item.productId, item.quantity])),
  );

  constructor() {
    merge(
      this.search.valueChanges.pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((value) => value.trim()),
        distinctUntilChanged(),
      ),
      this.reload$.pipe(map(() => this.search.value.trim())),
    )
      .pipe(
        startWith(''),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        switchMap((query) =>
          this.catalog.search({ search: query, page: 1, limit: PAGE_SIZE }).pipe(
            catchError(() => {
              this.error.set('No se pudo cargar el catálogo.');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((response) => {
        this.products.set(response?.data ?? []);
        this.loading.set(false);
      });
  }

  protected remaining(product: CatalogProduct): number {
    return Math.max(0, product.stock - (this.inCart().get(product.id) ?? 0));
  }

  protected canAdd(product: CatalogProduct): boolean {
    return product.active && this.remaining(product) > 0;
  }

  protected add(product: CatalogProduct): void {
    const result = this.cart.addItem(product);
    if (!result.ok) {
      this.notify.error(describeCartError(result.reason, result.max));
    }
  }

  protected retry(): void {
    this.reload$.next();
  }

  protected focusSearch(): void {
    this.searchInput()?.nativeElement.focus();
  }

  /**
   * Los lectores de código de barras "tipean" el código y envían Enter: se busca
   * el SKU exacto (o un único resultado) y se agrega sin pasar por el debounce.
   */
  protected onEnter(event: Event): void {
    event.preventDefault();
    const code = this.search.value.trim();
    if (!code) {
      return;
    }
    this.catalog
      .search({ search: code, page: 1, limit: 5 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data }) => {
          const match =
            data.find((p) => p.sku.toLowerCase() === code.toLowerCase()) ??
            (data.length === 1 ? data[0] : undefined);
          if (!match) {
            this.notify.info(`No se encontró un producto para "${code}".`);
            return;
          }
          this.add(match);
          this.search.setValue('');
        },
        error: () => this.notify.error('No se pudo buscar el producto.'),
      });
  }
}
