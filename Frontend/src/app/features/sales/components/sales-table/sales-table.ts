import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { Subject, catchError, forkJoin, map, of, startWith, switchMap, tap } from 'rxjs';
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { createSpanishPaginatorIntl } from '../../../inventory/utils/paginator-intl';
import { SALE_STATE_LABELS, SaleDetail, SaleState } from '../../models/sale.model';
import { SalesService } from '../../services/sales.service';
import { SaleDetailDialog, SaleDetailDialogData } from '../sale-detail-dialog/sale-detail-dialog';

const PAGE_SIZE = 10;

const STATE_BADGES: Record<SaleState, string> = {
  Ordered: 'sale-state--ordered',
  Paid: 'app-badge--income',
  Dispatched: '',
  Cancelled: 'app-badge--danger',
};

@Component({
  selector: 'app-sales-table',
  imports: [
    CurrencyPipe,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatTableModule,
    LoadingSpinner,
  ],
  providers: [{ provide: MatPaginatorIntl, useFactory: createSpanishPaginatorIntl }],
  templateUrl: './sales-table.html',
  styleUrl: './sales-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesTable {
  private readonly salesService = inject(SalesService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();

  protected readonly displayedColumns = [
    'number',
    'date',
    'product',
    'sku',
    'total',
    'state',
    'actions',
  ];
  protected readonly pageSize = PAGE_SIZE;
  protected readonly sales = signal<SaleDetail[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.reload$
      .pipe(
        startWith(undefined),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
        }),
        // GET /sales no trae los ítems: se pide el detalle de las ventas de la página
        switchMap(() =>
          this.salesService.listSales(this.page(), PAGE_SIZE).pipe(
            switchMap((res) =>
              (res.data.length
                ? forkJoin(res.data.map((sale) => this.salesService.getSaleDetail(sale.id)))
                : of([])
              ).pipe(map((details) => ({ details, total: res.meta.total }))),
            ),
            catchError(() => {
              this.error.set('No se pudieron cargar las ventas.');
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result) {
          this.sales.set(result.details);
          this.total.set(result.total);
        }
        this.loading.set(false);
      });
  }

  protected reload(): void {
    this.reload$.next();
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.reload();
  }

  protected stateLabel(sale: SaleDetail): string {
    return SALE_STATE_LABELS[sale.currentState];
  }

  protected stateBadge(sale: SaleDetail): string {
    return STATE_BADGES[sale.currentState];
  }

  protected products(sale: SaleDetail): string {
    return sale.items.map((item) => item.name).join(', ') || '—';
  }

  protected skus(sale: SaleDetail): string {
    return sale.items.map((item) => item.sku).join(', ') || '—';
  }

  protected edit(sale: SaleDetail): void {
    this.dialog
      .open<SaleDetailDialog, SaleDetailDialogData, SaleDetail>(SaleDetailDialog, {
        data: { sale },
        width: '44rem',
        maxWidth: '95vw',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updated) => {
        if (updated) {
          this.reload();
        }
      });
  }
}
