import { Injectable } from '@nestjs/common';
import type {
  AnalyticsGroupBy,
  InventoryValuationView,
  SalesTimeSeriesPoint,
  TopProductItem,
} from '@app/contracts';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Half-open [from, end): created_at has microseconds, so an inclusive
// 23:59:59.999 bound would drop a sale at 23:59:59.9995 from both periods
export interface DateRange {
  from: Date;
  end: Date;
}

export interface SalesTotals {
  revenue: number;
  salesCount: number;
  unitsSold: number;
  cancelledCount: number;
}

// Day boundaries follow the business, not the server (UTC in Docker)
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

// A dispatched sale was paid first: both count as revenue
const PAID_STATES = ['Paid', 'Dispatched'] as const;
const PAID_STATES_SQL = Prisma.sql`('Paid', 'Dispatched')`;

const LABEL_FORMAT: Record<AnalyticsGroupBy, string> = {
  day: 'YYYY-MM-DD',
  week: 'YYYY-MM-DD',
  month: 'YYYY-MM',
};

// Numeric aggregates come back as text so no precision is lost on the way
interface SeriesRow {
  period: string;
  revenue: string;
  salesCount: number;
}

interface TopProductRow {
  productId: string;
  name: string;
  sku: string;
  unitsSold: string;
  revenue: string;
}

interface InventoryRow {
  totalValuation: string;
  totalUnits: string;
  lowStockCount: number;
  outOfStockCount: number;
  activeProducts: number;
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async kpis({ from, end }: DateRange): Promise<SalesTotals> {
    const createdAt = { gte: from, lt: end };
    const paid = {
      currentState: { in: [...PAID_STATES] },
      createdAt,
    } satisfies Prisma.SaleWhereInput;

    const [sales, items, cancelledCount] = await this.prisma.$transaction([
      this.prisma.sale.aggregate({
        where: paid,
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.saleItem.aggregate({
        where: { sale: paid },
        _sum: { quantity: true },
      }),
      this.prisma.sale.count({
        where: { currentState: 'Cancelled', createdAt },
      }),
    ]);

    return {
      revenue: sales._sum.total?.toNumber() ?? 0,
      salesCount: sales._count._all,
      unitsSold: items._sum.quantity?.toNumber() ?? 0,
      cancelledCount,
    };
  }

  /**
   * One point per period between from and to, in Argentina time. Periods
   * without sales come from generate_series with zeros, so the chart has no
   * gaps. Weeks start on Monday (date_trunc).
   */
  async salesOverTime(
    { from, end }: DateRange,
    groupBy: AnalyticsGroupBy,
  ): Promise<SalesTimeSeriesPoint[]> {
    const rows = await this.prisma.$queryRaw<SeriesRow[]>`
      WITH buckets AS (
        SELECT generate_series(
          date_trunc(${groupBy}, ${from}::timestamptz AT TIME ZONE ${TIME_ZONE}),
          date_trunc(${groupBy}, (${end}::timestamptz - interval '1 millisecond') AT TIME ZONE ${TIME_ZONE}),
          ${`1 ${groupBy}`}::interval
        ) AS bucket
      ),
      totals AS (
        SELECT
          date_trunc(${groupBy}, s.created_at AT TIME ZONE ${TIME_ZONE}) AS bucket,
          SUM(s.total) AS revenue,
          COUNT(*)::int AS sales_count
        FROM erp.sales s
        WHERE s.current_state IN ${PAID_STATES_SQL}
          AND s.created_at >= ${from}::timestamptz
          AND s.created_at < ${end}::timestamptz
        GROUP BY 1
      )
      SELECT
        to_char(b.bucket, ${LABEL_FORMAT[groupBy]}) AS period,
        COALESCE(t.revenue, 0)::text AS revenue,
        COALESCE(t.sales_count, 0)::int AS "salesCount"
      FROM buckets b
      LEFT JOIN totals t ON t.bucket = b.bucket
      ORDER BY b.bucket`;

    return rows.map((row) => ({
      period: row.period,
      revenue: Number(row.revenue),
      salesCount: row.salesCount,
    }));
  }

  /**
   * Best sellers by units, then by revenue. Revenue uses the price snapshot of
   * each line (RN-07), rounded per line like the sale total.
   */
  async topProducts(
    { from, end }: DateRange,
    limit: number,
  ): Promise<TopProductItem[]> {
    const rows = await this.prisma.$queryRaw<TopProductRow[]>`
      SELECT
        p.id AS "productId",
        p.name,
        p.sku,
        SUM(si.quantity)::text AS "unitsSold",
        SUM(ROUND(si.unit_price * si.quantity, 2))::text AS revenue
      FROM erp.sale_items si
      JOIN erp.sales s ON s.id = si.sale_id
      JOIN erp.products p ON p.id = si.product_id
      WHERE s.current_state IN ${PAID_STATES_SQL}
        AND s.created_at >= ${from}::timestamptz
        AND s.created_at < ${end}::timestamptz
      GROUP BY p.id, p.name, p.sku
      ORDER BY SUM(si.quantity) DESC, SUM(ROUND(si.unit_price * si.quantity, 2)) DESC, p.name, p.id
      LIMIT ${limit}`;

    return rows.map((row) => ({
      productId: row.productId,
      name: row.name,
      sku: row.sku,
      unitsSold: Number(row.unitsSold),
      revenue: Number(row.revenue),
    }));
  }

  // Deleted products are out of the catalog, paused ones still hold stock.
  // lowStockCount uses the same rule as the inventory "low" filter.
  async inventoryValue(): Promise<InventoryValuationView> {
    const [row] = await this.prisma.$queryRaw<InventoryRow[]>`
      SELECT
        COALESCE(ROUND(SUM(stock * price), 2), 0)::text AS "totalValuation",
        COALESCE(SUM(stock), 0)::text AS "totalUnits",
        COUNT(*) FILTER (WHERE stock > 0 AND stock <= low_stock_threshold)::int AS "lowStockCount",
        COUNT(*) FILTER (WHERE stock = 0)::int AS "outOfStockCount",
        COUNT(*) FILTER (WHERE active)::int AS "activeProducts"
      FROM erp.products
      WHERE NOT deleted`;

    return {
      totalValuation: Number(row.totalValuation),
      totalUnits: Number(row.totalUnits),
      lowStockCount: row.lowStockCount,
      outOfStockCount: row.outOfStockCount,
      activeProducts: row.activeProducts,
    };
  }
}
