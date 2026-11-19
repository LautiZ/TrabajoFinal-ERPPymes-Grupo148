import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ISO_WITH_OFFSET } from './sale.dto';

// Shapes mirror the frontend (features/analytics/models/analytics.model.ts)

export const ANALYTICS_GROUP_BY = ['day', 'week', 'month'] as const;
export type AnalyticsGroupBy = (typeof ANALYTICS_GROUP_BY)[number];

// Both bounds are inclusive: the frontend sends the start of the first day
// (00:00:00.000) and the end of the last one (23:59:59.999) with its offset.
// Unlike ListSalesDto, whose `to` is exclusive: do not unify them by mistake.
export class AnalyticsRangeDto {
  /**
   * Inclusive lower bound on the sale date. ISO 8601 with time and offset
   * @example 2026-11-01T00:00:00.000-03:00
   */
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_OFFSET, { message: 'from must include time and offset' })
  from!: string;

  /**
   * Inclusive upper bound on the sale date. Same format as from
   * @example 2026-11-30T23:59:59.999-03:00
   */
  @IsISO8601({ strict: true })
  @Matches(ISO_WITH_OFFSET, { message: 'to must include time and offset' })
  to!: string;
}

export class SalesOverTimeDto extends AnalyticsRangeDto {
  /** Size of each point of the series; weeks start on Monday */
  @IsOptional()
  @IsIn(ANALYTICS_GROUP_BY)
  groupBy: AnalyticsGroupBy = 'day';
}

export class TopProductsDto extends AnalyticsRangeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit: number = 10;
}

export interface KpiMetrics {
  /** Sum of the totals of paid sales (Paid or Dispatched) */
  revenue: number;
  salesCount: number;
  /** revenue / salesCount, 0 when there are no sales */
  averageTicket: number;
  /** Sum of item quantities (units, kg, meters and liters added as they are) */
  unitsSold: number;
  /** Sales cancelled in the range: not part of the other metrics */
  cancelledCount: number;
}

export interface AnalyticsSummaryView {
  current: KpiMetrics;
  /** Same metrics for the period of equal length right before `from` */
  previous: KpiMetrics;
}

export interface SalesTimeSeriesPoint {
  /** Start of the period in Argentina time: YYYY-MM-DD (day, week) or YYYY-MM (month) */
  period: string;
  revenue: number;
  salesCount: number;
}

export interface SalesOverTimeView {
  groupBy: AnalyticsGroupBy;
  series: SalesTimeSeriesPoint[];
}

export interface TopProductItem {
  productId: string;
  name: string;
  sku: string;
  unitsSold: number;
  /** Uses the price at the moment of each sale (RN-07), not the current one */
  revenue: number;
}

export interface TopProductsView {
  items: TopProductItem[];
}

export interface InventoryValuationView {
  /** Sum of stock x current price of every product not deleted */
  totalValuation: number;
  totalUnits: number;
  /** Same rule as the inventory "low" filter: 0 < stock <= threshold */
  lowStockCount: number;
  outOfStockCount: number;
  activeProducts: number;
}
