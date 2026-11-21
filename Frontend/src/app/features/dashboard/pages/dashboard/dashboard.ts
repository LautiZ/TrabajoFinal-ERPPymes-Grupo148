import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { catchError, forkJoin, of } from 'rxjs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingSpinner } from '../../../../shared/components/loading-spinner/loading-spinner';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { AnalyticsService } from '../../../analytics/services/analytics.service';
import { StockMovement, movementReason } from '../../models/stock-movement.model';
import { StockMovementsService } from '../../services/stock-movements.service';

const RECENT_MOVEMENTS = 10;

interface Indicator {
  key: 'valuation' | 'lowStock' | 'monthSales' | 'todaySales';
  label: string;
  icon: string;
  hint: string;
  value: string;
  tone?: 'default' | 'danger';
}

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function toYmd(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatTableModule,
    PageHeader,
    StatCard,
    EmptyState,
    LoadingSpinner,
  ],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stockMovements = inject(StockMovementsService);

  protected readonly movementColumns = ['direction', 'product', 'sku', 'quantity', 'reason', 'date'];
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly movementsLoading = signal(true);
  protected readonly movementsError = signal(false);

  protected readonly indicators = signal<readonly Indicator[]>([
    {
      key: 'valuation',
      label: 'Valor del inventario',
      icon: 'account_balance_wallet',
      hint: 'Valorización actual del stock',
      value: '—',
    },
    {
      key: 'lowStock',
      label: 'Alertas de stock',
      icon: 'warning',
      hint: 'Productos bajo el mínimo',
      value: '—',
      tone: 'danger',
    },
    {
      key: 'monthSales',
      label: 'Ventas del mes',
      icon: 'payments',
      hint: 'Ingresos acumulados del mes',
      value: '—',
    },
    {
      key: 'todaySales',
      label: 'Ventas de hoy',
      icon: 'receipt_long',
      hint: 'Ingresos del día de hoy',
      value: '—',
    },
  ]);

  protected reasonOf(movement: StockMovement): string {
    return movementReason(movement);
  }

  protected isIncome(movement: StockMovement): boolean {
    return movement.direction === 'In';
  }

  private loadMovements(): void {
    this.stockMovements
      .list(1, RECENT_MOVEMENTS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.movements.set(res.data);
          this.movementsLoading.set(false);
        },
        error: () => {
          this.movementsError.set(true);
          this.movementsLoading.set(false);
        },
      });
  }

  ngOnInit(): void {
    this.loadMovements();
    const now = new Date();
    const today = toYmd(now);
    const monthStart = toYmd(new Date(now.getFullYear(), now.getMonth(), 1));

    forkJoin({
      inventory: this.analytics.getInventoryValue().pipe(catchError(() => of(null))),
      monthSummary: this.analytics.getSummary(monthStart, today).pipe(catchError(() => of(null))),
      todaySummary: this.analytics.getSummary(today, today).pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ inventory, monthSummary, todaySummary }) => {
        this.indicators.update((list) =>
          list.map((indicator) => {
            switch (indicator.key) {
              case 'valuation':
                return {
                  ...indicator,
                  value:
                    inventory != null ? arsFormatter.format(Number(inventory.totalValuation)) : '—',
                  hint:
                    inventory != null
                      ? `${Number(inventory.totalUnits)} unidades en stock`
                      : indicator.hint,
                };
              case 'lowStock':
                return {
                  ...indicator,
                  value: inventory != null ? String(Number(inventory.lowStockCount)) : '—',
                };
              case 'monthSales':
                return {
                  ...indicator,
                  value:
                    monthSummary != null
                      ? arsFormatter.format(Number(monthSummary.current.revenue))
                      : '—',
                  hint:
                    monthSummary != null
                      ? `${Number(monthSummary.current.salesCount)} ventas registradas`
                      : indicator.hint,
                };
              case 'todaySales':
                return {
                  ...indicator,
                  value:
                    todaySummary != null
                      ? arsFormatter.format(Number(todaySummary.current.revenue))
                      : '—',
                  hint:
                    todaySummary != null
                      ? `${Number(todaySummary.current.salesCount)} ventas hoy`
                      : indicator.hint,
                };
            }
          }),
        );
      });
  }
}