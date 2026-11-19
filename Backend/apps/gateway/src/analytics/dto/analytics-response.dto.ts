import { ApiProperty } from '@nestjs/swagger';
import {
  ANALYTICS_GROUP_BY,
  type AnalyticsGroupBy,
  type AnalyticsSummaryView,
  type InventoryValuationView,
  type KpiMetrics,
  type SalesOverTimeView,
  type SalesTimeSeriesPoint,
  type TopProductItem,
  type TopProductsView,
} from '@app/contracts';

// HTTP response shapes only: documented for Swagger, not validated.
// `implements` keeps them in sync with what the ERP MS returns.

export class KpiMetricsDto implements KpiMetrics {
  /** Sum of the totals of paid sales (Paid or Dispatched) @example 152300.5 */
  revenue!: number;
  /** @example 42 */
  salesCount!: number;
  /** revenue / salesCount, 0 without sales @example 3626.2 */
  averageTicket!: number;
  /** Sum of item quantities (units, kg, meters and liters as they are) @example 118.5 */
  unitsSold!: number;
  /** Sales cancelled in the range; not part of the other metrics @example 3 */
  cancelledCount!: number;
}

export class AnalyticsSummaryResponseDto implements AnalyticsSummaryView {
  current!: KpiMetricsDto;
  /** Same metrics for the period of equal length right before `from` */
  previous!: KpiMetricsDto;
}

export class SalesTimeSeriesPointDto implements SalesTimeSeriesPoint {
  /** Start of the period in Argentina time: YYYY-MM-DD (day, week) or YYYY-MM (month) @example 2026-11-17 */
  period!: string;
  /** @example 12500 */
  revenue!: number;
  /** @example 4 */
  salesCount!: number;
}

export class SalesOverTimeResponseDto implements SalesOverTimeView {
  @ApiProperty({ enum: ANALYTICS_GROUP_BY, example: 'day' })
  groupBy!: AnalyticsGroupBy;
  /** One point per period of the range, including periods without sales (zeros) */
  series!: SalesTimeSeriesPointDto[];
}

export class TopProductItemDto implements TopProductItem {
  productId!: string;
  /** @example Yerba mate 1 kg */
  name!: string;
  /** @example YER-1KG */
  sku!: string;
  /** @example 25 */
  unitsSold!: number;
  /** Price at the moment of each sale (RN-07), not the current one @example 105000 */
  revenue!: number;
}

export class TopProductsResponseDto implements TopProductsView {
  /** Sorted by units sold, then by revenue */
  items!: TopProductItemDto[];
}

export class InventoryValuationResponseDto implements InventoryValuationView {
  /** Sum of stock x current price of every product not deleted @example 1850000 */
  totalValuation!: number;
  /** @example 640.5 */
  totalUnits!: number;
  /** Same rule as GET /products?stockStatus=low: 0 < stock <= threshold @example 4 */
  lowStockCount!: number;
  /** @example 2 */
  outOfStockCount!: number;
  /** @example 37 */
  activeProducts!: number;
}
