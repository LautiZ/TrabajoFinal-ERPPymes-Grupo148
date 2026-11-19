import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { catchError, forkJoin, of } from 'rxjs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { AnalyticsService } from '../../../analytics/services/analytics.service';

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
  imports: [RouterLink, MatButtonModule, PageHeader, StatCard, EmptyState],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard implements OnInit {
  private readonly analytics = inject(AnalyticsService);
  private readonly destroyRef = inject(DestroyRef);

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

  ngOnInit(): void {
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
                };
              case 'todaySales':
                return {
                  ...indicator,
                  value:
                    todaySummary != null
                      ? arsFormatter.format(Number(todaySummary.current.revenue))
                      : '—',
                };
            }
          }),
        );
      });
  }
}