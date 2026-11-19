import { Injectable } from '@nestjs/common';
import type {
  AnalyticsGroupBy,
  AnalyticsRangeDto,
  AnalyticsSummaryView,
  InventoryValuationView,
  KpiMetrics,
  SalesOverTimeDto,
  SalesOverTimeView,
  TopProductsDto,
  TopProductsView,
} from '@app/contracts';
import { rpcError } from '../common/rpc-error';
import {
  AnalyticsRepository,
  DateRange,
  SalesTotals,
} from './analytics.repository';

const DAY_MS = 86_400_000;
// Reports read aggregated rows, but a huge range is still a mistake
const MAX_RANGE_DAYS = 5 * 365 + 2;
// More points than this does not fit in a chart and only costs work
const MAX_POINTS = 400;

// Upper bound of the series length. Weeks and months may start before `from`
// (date_trunc), which can add one partial bucket at the start.
const pointsOf = (days: number, groupBy: AnalyticsGroupBy) => {
  if (groupBy === 'day') return Math.ceil(days);
  return Math.ceil(days / (groupBy === 'week' ? 7 : 28)) + 1;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

// The API takes inclusive bounds (the frontend sends 23:59:59.999); the
// repository works with the half-open [from, end), end = to + 1 ms
const toRange = ({ from, to }: AnalyticsRangeDto): DateRange => {
  const start = new Date(from);
  const last = new Date(to);
  // Some ISO 8601 forms pass the validator but not Date (e.g. 2026-W44-1)
  if (Number.isNaN(start.getTime()) || Number.isNaN(last.getTime())) {
    throw rpcError(400, 'from and to must be valid dates');
  }
  if (start > last) throw rpcError(400, 'from must not be after to');
  const range = { from: start, end: new Date(last.getTime() + 1) };
  if (spanDays(range) > MAX_RANGE_DAYS) {
    throw rpcError(400, 'The range cannot be longer than 5 years');
  }
  return range;
};

const spanDays = ({ from, end }: DateRange) =>
  (end.getTime() - from.getTime()) / DAY_MS;

// The period of equal length that ends where the current one starts
const previousOf = ({ from, end }: DateRange): DateRange => ({
  from: new Date(from.getTime() - (end.getTime() - from.getTime())),
  end: from,
});

const toMetrics = (totals: SalesTotals): KpiMetrics => ({
  revenue: totals.revenue,
  salesCount: totals.salesCount,
  averageTicket:
    totals.salesCount > 0 ? round2(totals.revenue / totals.salesCount) : 0,
  unitsSold: totals.unitsSold,
  cancelledCount: totals.cancelledCount,
});

// Financial reports for the dashboard (TES-85/86/87). Only paid sales count
// as revenue; the repository aggregates in SQL, never in memory.
@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  async summary(dto: AnalyticsRangeDto): Promise<AnalyticsSummaryView> {
    const range = toRange(dto);
    const [current, previous] = await Promise.all([
      this.analyticsRepository.kpis(range),
      this.analyticsRepository.kpis(previousOf(range)),
    ]);
    return { current: toMetrics(current), previous: toMetrics(previous) };
  }

  async salesOverTime({
    groupBy,
    ...dto
  }: SalesOverTimeDto): Promise<SalesOverTimeView> {
    const range = toRange(dto);
    if (pointsOf(spanDays(range), groupBy) > MAX_POINTS) {
      throw rpcError(
        400,
        `Too many points for groupBy=${groupBy}: use a shorter range or a larger grouping`,
      );
    }
    return {
      groupBy,
      series: await this.analyticsRepository.salesOverTime(range, groupBy),
    };
  }

  async topProducts({
    limit,
    ...dto
  }: TopProductsDto): Promise<TopProductsView> {
    return {
      items: await this.analyticsRepository.topProducts(toRange(dto), limit),
    };
  }

  inventoryValue(): Promise<InventoryValuationView> {
    return this.analyticsRepository.inventoryValue();
  }
}
