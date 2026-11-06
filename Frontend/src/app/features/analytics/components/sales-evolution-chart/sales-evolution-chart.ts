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
import { AnalyticsGroupBy, SalesTimeSeriesPoint } from '../../models/analytics.model';

@Component({
  selector: 'app-sales-evolution-chart',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './sales-evolution-chart.html',
  styleUrl: './sales-evolution-chart.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesEvolutionChartComponent {
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
  protected readonly series = signal<SalesTimeSeriesPoint[]>([]);
  protected readonly chartType = signal<'line' | 'bar'>('line');

  protected readonly activeGroupBy = computed(() => this.analyticsService.groupBy());

  protected readonly isEmpty = computed(() => {
    const points = this.series();
    if (this.loading() || this.error()) {
      return false;
    }
    return (
      points.length === 0 ||
      points.every((point) => point.revenue === 0 && point.salesCount === 0)
    );
  });

  protected readonly chartData = computed<ChartData<'line' | 'bar'>>(() => {
    const points = this.series();
    return {
      labels: points.map((p) => p.period),
      datasets: [
        {
          label: 'Ingresos (ARS)',
          data: points.map((p) => p.revenue),
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.25)',
          yAxisID: 'yRevenue',
          tension: 0.3,
          fill: true,
        },
        {
          label: 'Cantidad de ventas',
          data: points.map((p) => p.salesCount),
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.25)',
          yAxisID: 'ySales',
          tension: 0.3,
        },
      ],
    };
  });

  protected readonly chartOptions: ChartConfiguration<'line' | 'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const label = ctx.dataset.label ?? '';
            const rawValue = Number(ctx.parsed.y ?? 0);
            if (ctx.dataset.yAxisID === 'yRevenue') {
              return `${label}: ${this.currencyFormatter.format(rawValue)}`;
            }
            return `${label}: ${rawValue.toLocaleString('es-AR')} ventas`;
          },
        },
      },
    },
    scales: {
      yRevenue: {
        type: 'linear',
        display: true,
        position: 'left',
        ticks: {
          callback: (value) => this.currencyFormatter.format(Number(value)),
        },
      },
      ySales: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          precision: 0,
        },
      },
    },
  };

  constructor() {
    effect(() => {
      const from = this.analyticsService.from();
      const to = this.analyticsService.to();
      const groupBy = this.analyticsService.groupBy();
      this.loadSeries(from, to, groupBy);
    });
  }

  changeGroupBy(groupBy: AnalyticsGroupBy): void {
    if (this.activeGroupBy() !== groupBy) {
      this.analyticsService.updateGroupBy(groupBy);
    }
  }

  toggleChartType(type: 'line' | 'bar'): void {
    this.chartType.set(type);
  }

  retry(): void {
    this.loadSeries(
      this.analyticsService.from(),
      this.analyticsService.to(),
      this.analyticsService.groupBy(),
    );
  }

  loadSeries(from: string, to: string, groupBy: AnalyticsGroupBy): void {
    this.loading.set(true);
    this.error.set(null);

    this.analyticsService.getSalesOverTime(from, to, groupBy).subscribe({
      next: (res) => {
        this.series.set(res.series ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar la evolución de ventas.');
        this.loading.set(false);
      },
    });
  }
}