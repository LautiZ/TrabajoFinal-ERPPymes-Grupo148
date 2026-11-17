import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AnalyticsService } from '../../services/analytics.service';
import {
  AnalyticsSummaryResponse,
  InventoryValuationResponse,
} from '../../models/analytics.model';

export interface KpiCardViewModel {
  id: string;
  label: string;
  formattedValue: string;
  variationPercentage: number | null;
  formattedVariation: string;
  trend: 'positive' | 'negative' | 'neutral';
}

@Component({
  selector: 'app-kpi-cards',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './kpi-cards.html',
  styleUrl: './kpi-cards.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiCardsComponent {
  private readonly analyticsService = inject(AnalyticsService);

  private readonly currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  private readonly numberFormatter = new Intl.NumberFormat('es-AR', {
    maximumFractionDigits: 0,
  });

  private readonly percentFormatter = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly summary = signal<AnalyticsSummaryResponse | null>(null);
  protected readonly inventory = signal<InventoryValuationResponse | null>(null);

  protected readonly isEmpty = computed(() => {
    const s = this.summary();
    return !this.loading() && !this.error() && (!s || s.current.salesCount === 0);
  });

  protected readonly salesKpis = computed<KpiCardViewModel[]>(() => {
    const data = this.summary();
    if (!data) {
      return [];
    }

    return [
      this.buildKpiCard(
        'revenue',
        'Ingresos',
        this.formatCurrency(data.current.revenue),
        data.current.revenue,
        data.previous.revenue,
      ),
      this.buildKpiCard(
        'salesCount',
        'Cantidad de ventas',
        this.formatNumber(data.current.salesCount),
        data.current.salesCount,
        data.previous.salesCount,
      ),
      this.buildKpiCard(
        'averageTicket',
        'Ticket promedio',
        this.formatCurrency(data.current.averageTicket),
        data.current.averageTicket,
        data.previous.averageTicket,
      ),
      this.buildKpiCard(
        'unitsSold',
        'Unidades vendidas',
        this.formatNumber(data.current.unitsSold),
        data.current.unitsSold,
        data.previous.unitsSold,
      ),
    ];
  });

  protected readonly formattedInventoryValuation = computed(() => {
    const inv = this.inventory();
    return inv ? this.formatCurrency(inv.totalValuation) : this.formatCurrency(0);
  });

  constructor() {
    // Cada vez que cambia el rango (from / to) en el signal compartido, recarga las tarjetas
    effect(() => {
      const from = this.analyticsService.from();
      const to = this.analyticsService.to();
      this.loadKpiData(from, to);
    });
  }

  retry(): void {
    this.loadKpiData(this.analyticsService.from(), this.analyticsService.to());
  }

  loadKpiData(from: string, to: string): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      summary: this.analyticsService.getSummary(from, to),
      inventory: this.analyticsService.getInventoryValue(),
    }).subscribe({
      next: ({ summary, inventory }) => {
        this.summary.set(summary);
        this.inventory.set(inventory);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los indicadores financieros.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Calcula la variación porcentual contra el período anterior manejando la división por cero.
   */
  calculateVariation(current: number, previous: number): number | null {
    if (previous === 0) {
      return current === 0 ? 0 : null;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  formatCurrency(value: number): string {
    return this.currencyFormatter.format(value);
  }

  formatNumber(value: number): string {
    return this.numberFormatter.format(value);
  }

  private buildKpiCard(
    id: string,
    label: string,
    formattedValue: string,
    current: number,
    previous: number,
  ): KpiCardViewModel {
    const variation = this.calculateVariation(current, previous);

    if (variation === null) {
      return {
        id,
        label,
        formattedValue,
        variationPercentage: null,
        formattedVariation: 'Nuevo (+100%)',
        trend: current > 0 ? 'positive' : 'neutral',
      };
    }

    const sign = variation > 0 ? '+' : '';
    const trend = variation > 0 ? 'positive' : variation < 0 ? 'negative' : 'neutral';

    return {
      id,
      label,
      formattedValue,
      variationPercentage: variation,
      formattedVariation: `${sign}${this.percentFormatter.format(variation)}%`,
      trend,
    };
  }
}