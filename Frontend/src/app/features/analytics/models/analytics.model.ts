export type AnalyticsGroupBy = 'day' | 'week' | 'month';

export type DateRangePreset = 'today' | 'last7days' | 'currentMonth' | 'previousMonth' | 'custom';

export interface DateRangeFilter {
  from: string;
  to: string;
  groupBy: AnalyticsGroupBy;
  preset?: DateRangePreset;
}

export interface KpiMetrics {
  revenue: number;
  salesCount: number;
  averageTicket: number;
  unitsSold: number;
}

export interface AnalyticsSummaryResponse {
  current: KpiMetrics;
  previous: KpiMetrics;
}

export interface SalesTimeSeriesPoint {
  period: string;
  revenue: number;
  salesCount: number;
}

export interface SalesOverTimeResponse {
  groupBy: AnalyticsGroupBy;
  series: SalesTimeSeriesPoint[];
}

export interface TopProductItem {
  productId: string;
  name: string;
  sku?: string;
  unitsSold: number;
  revenue: number;
}

export interface TopProductsResponse {
  items: TopProductItem[];
}

export interface InventoryValuationResponse {
  totalValuation: number;
  totalUnits: number;
  lowStockCount: number;
}