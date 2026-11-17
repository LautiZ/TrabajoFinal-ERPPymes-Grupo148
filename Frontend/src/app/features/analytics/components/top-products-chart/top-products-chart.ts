import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { AnalyticsService } from '../../services/analytics.service';
import { TopProductItem } from '../../models/analytics.model';

@Component({
  selector: 'app-top-products-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './top-products-chart.html',
  styleUrl: './top-products-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopProductsChartComponent {
  private readonly analyticsService = inject(AnalyticsService);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

  protected readonly isBrowser = isPlatformBrowser(this.platformId);
  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<TopProductItem[]>([]);
  protected readonly metric = signal<'revenue' | 'units'>('revenue');

  protected readonly isEmpty = computed(() => {
    return !this.loading() && !this.error() && this.items().length === 0;
  });

  protected readonly chartData = computed<ChartData<'bar'>>(() => {
    const list = this.items();
    const isRevenue = this.metric() === 'revenue';

    return {
      labels: list.map((item) => item.name),
      datasets: [
        {
          label: isRevenue ? 'Ingresos (ARS)' : 'Unidades vendidas',
          data: list.map((item) => (isRevenue ? item.revenue : item.unitsSold)),
          backgroundColor: isRevenue ? 'rgba(96, 165, 250, 0.75)' : 'rgba(52, 211, 153, 0.75)',
          borderColor: isRevenue ? '#60a5fa' : '#34d399',
          borderWidth: 1,
          borderRadius: 6,
        },
      ],
    };
  });

  protected readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const item = this.items()[ctx.dataIndex];
            if (!item) {
              return '';
            }
            return `${this.formatCurrency(item.revenue)} (${item.unitsSold.toLocaleString('es-AR')} u.)`;
          },
        },
      },
    },
  };

  constructor() {
    effect(() => {
      const from = this.analyticsService.from();
      const to = this.analyticsService.to();
      this.loadTopProducts(from, to);
    });
  }

  setMetric(metric: 'revenue' | 'units'): void {
    this.metric.set(metric);
  }

  retry(): void {
    this.loadTopProducts(this.analyticsService.from(), this.analyticsService.to());
  }

  loadTopProducts(from: string, to: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsService.getTopProducts(from, to, 5).subscribe({
      next: (res) => {
        this.items.set(res.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el top de productos.');
        this.loading.set(false);
      },
    });
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }
}