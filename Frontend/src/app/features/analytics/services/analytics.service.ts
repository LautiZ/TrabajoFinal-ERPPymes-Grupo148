import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, QueryParams } from '../../../core/services/api.service';
import {
  AnalyticsGroupBy,
  AnalyticsSummaryResponse,
  DateRangeFilter,
  DateRangePreset,
  InventoryValuationResponse,
  SalesOverTimeResponse,
  TopProductsResponse,
} from '../models/analytics.model';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly api = inject(ApiService);
  private readonly basePath = 'analytics';

  /** Estado reactivo del filtro compartido por todos los componentes del dashboard */
  private readonly filterState = signal<DateRangeFilter>(this.createDefaultFilter());

  readonly filter = this.filterState.asReadonly();
  readonly from = computed(() => this.filterState().from);
  readonly to = computed(() => this.filterState().to);
  readonly groupBy = computed(() => this.filterState().groupBy);

  /** Actualiza el rango de fechas (y opcionalmente el preset o agrupación) */
  updateDateRange(from: string, to: string, preset: DateRangePreset = 'custom'): void {
    this.filterState.update((current) => ({
      ...current,
      from,
      to,
      preset,
    }));
  }

  /** Actualiza la agrupación temporal (día / semana / mes) */
  updateGroupBy(groupBy: AnalyticsGroupBy): void {
    this.filterState.update((current) => ({
      ...current,
      groupBy,
    }));
  }

  /** Actualiza todo el estado del filtro de una vez */
  setFilter(newFilter: Partial<DateRangeFilter>): void {
    this.filterState.update((current) => ({
      ...current,
      ...newFilter,
    }));
  }

  /**
   * Obtiene el resumen de KPIs del período elegido y del período anterior.
   */
  getSummary(from = this.from(), to = this.to()): Observable<AnalyticsSummaryResponse> {
    const params: QueryParams = {
      from: this.toIsoWithLocalTimezone(from, false),
      to: this.toIsoWithLocalTimezone(to, true),
    };
    return this.api.get<AnalyticsSummaryResponse>(`${this.basePath}/summary`, params);
  }

  /**
   * Obtiene la evolución de ingresos y ventas en el tiempo según la agrupación.
   */
  getSalesOverTime(
    from = this.from(),
    to = this.to(),
    groupBy: AnalyticsGroupBy = this.groupBy(),
  ): Observable<SalesOverTimeResponse> {
    const params: QueryParams = {
      from: this.toIsoWithLocalTimezone(from, false),
      to: this.toIsoWithLocalTimezone(to, true),
      groupBy,
    };
    return this.api.get<SalesOverTimeResponse>(`${this.basePath}/sales-over-time`, params);
  }

  /**
   * Obtiene el ranking de productos más vendidos por unidades e ingresos.
   */
  getTopProducts(
    from = this.from(),
    to = this.to(),
    limit = 10,
  ): Observable<TopProductsResponse> {
    const params: QueryParams = {
      from: this.toIsoWithLocalTimezone(from, false),
      to: this.toIsoWithLocalTimezone(to, true),
      limit,
    };
    return this.api.get<TopProductsResponse>(`${this.basePath}/top-products`, params);
  }

  /**
   * Obtiene la valorización actual del inventario y conteo de stock bajo.
   */
  getInventoryValue(): Observable<InventoryValuationResponse> {
    return this.api.get<InventoryValuationResponse>(`${this.basePath}/inventory-value`);
  }

  /**
   * Convierte una fecha (YYYY-MM-DD o ISO) a string ISO 8601 respetando el inicio (00:00:00.000)
   * o fin (23:59:59.999) del día en la zona horaria local.
   */
  toIsoWithLocalTimezone(dateInput: string, isEndOfDay: boolean): string {
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput.trim());

    let date: Date;
    if (dateOnlyMatch) {
      const year = Number(dateOnlyMatch[1]);
      const month = Number(dateOnlyMatch[2]) - 1;
      const day = Number(dateOnlyMatch[3]);

      date = isEndOfDay
        ? new Date(year, month, day, 23, 59, 59, 999)
        : new Date(year, month, day, 0, 0, 0, 0);
    } else {
      date = new Date(dateInput);
    }

    const tzOffsetMinutes = -date.getTimezoneOffset();
    const sign = tzOffsetMinutes >= 0 ? '+' : '-';
    const absOffset = Math.abs(tzOffsetMinutes);
    const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetMinutes = String(absOffset % 60).padStart(2, '0');

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');

    return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}.${ms}${sign}${offsetHours}:${offsetMinutes}`;
  }

  private createDefaultFilter(): DateRangeFilter {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      from: this.formatDateYmd(firstDay),
      to: this.formatDateYmd(now),
      groupBy: 'day',
      preset: 'currentMonth',
    };
  }

  private formatDateYmd(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}