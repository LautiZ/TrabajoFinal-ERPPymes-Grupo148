import { Test } from '@nestjs/testing';
import { AnalyticsRepository } from '../src/analytics/analytics.repository';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';

// TES-88 acceptance: the reports answer in reasonable time with a large
// sales volume. 50k sales over a year, 100k items, generated in SQL.
// Measured by hand with 100k sales (EXPLAIN ANALYZE, see TES-88): a month
// uses idx_sales_current_state_created_at (~5 ms); a year reads most of the
// table, where a sequential scan is the right plan (~50-60 ms).
const SALES = 50_000;
const BUDGET_MS = 1_500;

const isoDaysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString();

describe('ERP analytics with a large sales volume', () => {
  let prisma: PrismaService;
  let service: AnalyticsService;

  const timed = async <T>(run: () => Promise<T>) => {
    const start = performance.now();
    const result = await run();
    return { result, ms: performance.now() - start };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, AnalyticsRepository, AnalyticsService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(AnalyticsService);
    await prisma.$connect();

    await prisma.$executeRawUnsafe(
      'TRUNCATE erp.stock_movements, erp.sale_history, erp.sale_items, erp.sales, erp.products, erp.categories RESTART IDENTITY CASCADE',
    );
    await prisma.$executeRawUnsafe(
      `INSERT INTO erp.categories (name) VALUES ('Bulk')`,
    );
    await prisma.$executeRawUnsafe(`
      INSERT INTO erp.products (name, sku, price, stock, unit, category_id, low_stock_threshold, updated_at)
      SELECT 'P' || g, 'SKU-' || g, 100 + g, 50, 'Unit', (SELECT id FROM erp.categories LIMIT 1), 5, now()
      FROM generate_series(1, 200) g`);
    await prisma.$executeRawUnsafe(`
      INSERT INTO erp.sales (total, user_id, current_state, created_at, updated_at)
      SELECT 1, gen_random_uuid(),
        (ARRAY['Paid','Paid','Paid','Dispatched','Ordered','Cancelled'])[1 + (g % 6)]::erp.sale_states,
        now() - (g % 365) * interval '1 day' - (g % 1440) * interval '1 minute', now()
      FROM generate_series(1, ${SALES}) g`);
    await prisma.$executeRawUnsafe(`
      WITH p AS (SELECT id, price, row_number() OVER () AS n FROM erp.products)
      INSERT INTO erp.sale_items (product_id, sale_id, quantity, unit_price)
      SELECT p.id, s.id, 1 + (s.sale_number % 3), p.price
      FROM erp.sales s JOIN p ON p.n IN (1 + s.sale_number % 200, 1 + (s.sale_number * 7 + 3) % 200)`);
    await prisma.$executeRawUnsafe(`
      UPDATE erp.sales s SET total = t.total
      FROM (SELECT sale_id, SUM(quantity * unit_price) AS total FROM erp.sale_items GROUP BY sale_id) t
      WHERE t.sale_id = s.id`);
    await prisma.$executeRawUnsafe(
      'ANALYZE erp.sales, erp.sale_items, erp.products',
    );
  }, 120_000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const year = { from: isoDaysAgo(365), to: new Date().toISOString() };
  const month = { from: isoDaysAgo(30), to: new Date().toISOString() };

  it.each([
    ['summary of a year', () => service.summary(year)],
    ['summary of a month', () => service.summary(month)],
    [
      'daily series of a year',
      () => service.salesOverTime({ ...year, groupBy: 'day' }),
    ],
    [
      'weekly series of a year',
      () => service.salesOverTime({ ...year, groupBy: 'week' }),
    ],
    [
      'top products of a year',
      () => service.topProducts({ ...year, limit: 10 }),
    ],
    ['inventory value', () => service.inventoryValue()],
  ])(`%s answers in under ${BUDGET_MS} ms`, async (_name, run) => {
    const { ms } = await timed(run as () => Promise<unknown>);
    expect(ms).toBeLessThan(BUDGET_MS);
  });

  it('still adds up: the yearly series equals the yearly summary', async () => {
    const [{ current }, { series }] = await Promise.all([
      service.summary(year),
      service.salesOverTime({ ...year, groupBy: 'day' }),
    ]);
    const fromSeries = series.reduce((sum, p) => sum + p.revenue, 0);
    expect(Math.round(fromSeries * 100)).toBe(
      Math.round(current.revenue * 100),
    );
    expect(series.reduce((sum, p) => sum + p.salesCount, 0)).toBe(
      current.salesCount,
    );
  });
});
