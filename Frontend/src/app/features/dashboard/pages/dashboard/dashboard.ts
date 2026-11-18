import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';
import { AnalyticsService } from '../../../analytics/services/analytics.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { LowStockThresholdService } from '../../../inventory/services/low-stock-threshold.service';

interface Indicator {
  label: string;
  value: string;
  icon: string;
  hint: string;
  tone?: 'default' | 'danger';
}

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

@Component({
  imports: [RouterLink, MatButtonModule, PageHeader, StatCard, EmptyState],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  private readonly analytics = inject(AnalyticsService);
  private readonly inventory = inject(InventoryService);
  private readonly thresholdService = inject(LowStockThresholdService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly inventoryValue = signal<string>('—');
  private readonly inventoryHint = signal<string>('Calculando inventario...');
  private readonly stockAlerts = signal<string>('—');
  private readonly stockAlertsHint = signal<string>('Productos bajo el mínimo');
  private readonly monthSales = signal<string>('—');
  private readonly monthSalesHint = signal<string>('Ingresos del mes actual');
  private readonly todaySales = signal<string>('—');
  private readonly todaySalesHint = signal<string>('Ingresos de hoy');

  protected readonly indicators = computed<readonly Indicator[]>(() => [
    {
      label: 'Valor del inventario',
      value: this.inventoryValue(),
      icon: 'account_balance_wallet',
      hint: this.inventoryHint(),
    },
    {
      label: 'Alertas de stock',
      value: this.stockAlerts(),
      icon: 'warning',
      hint: this.stockAlertsHint(),
      tone: 'danger',
    },
    {
      label: 'Ventas del mes',
      value: this.monthSales(),
      icon: 'payments',
      hint: this.monthSalesHint(),
    },
    {
      label: 'Ventas de hoy',
      value: this.todaySales(),
      icon: 'receipt_long',
      hint: this.todaySalesHint(),
    },
  ]);

  constructor() {
    const now = new Date();
    const todayStr = this.formatYmd(now);
    const firstOfMonthStr = this.formatYmd(new Date(now.getFullYear(), now.getMonth(), 1));
    const threshold = this.thresholdService.value();

    forkJoin({
      valuation: this.analytics.getInventoryValue().pipe(catchError(() => of(null))),
      productsPage: this.inventory
        .list({ page: 1, limit: 100 })
        .pipe(catchError(() => of(null))),
      month: this.analytics
        .getSummary(firstOfMonthStr, todayStr)
        .pipe(catchError(() => of(null))),
      today: this.analytics
        .getSummary(todayStr, todayStr)
        .pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ valuation, productsPage, month, today }) => {
        if (valuation) {
          this.inventoryValue.set(arsFormatter.format(valuation.totalValuation));
          this.inventoryHint.set(`${valuation.totalUnits} unidades en catálogo`);
        } else if (productsPage) {
          const totalVal = productsPage.data.reduce((acc, p) => acc + p.price * p.stock, 0);
          this.inventoryValue.set(arsFormatter.format(totalVal));
          this.inventoryHint.set(`${productsPage.meta.total} productos activos`);
        }

        if (productsPage) {
          const alertsCount = productsPage.data.filter((p) => p.stock <= threshold).length;
          this.stockAlerts.set(String(alertsCount));
          this.stockAlertsHint.set(`Productos con stock ≤ ${threshold}`);
        } else if (valuation) {
          this.stockAlerts.set(String(valuation.lowStockCount));
        }

        if (month) {
          this.monthSales.set(arsFormatter.format(month.current.revenue));
          this.monthSalesHint.set(`${month.current.salesCount} ventas registradas`);
        }

        if (today) {
          this.todaySales.set(arsFormatter.format(today.current.revenue));
          this.todaySalesHint.set(`${today.current.salesCount} ventas hoy`);
        }
      });
  }

  private formatYmd(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}