import { randomUUID } from 'crypto';
import { Test } from '@nestjs/testing';
import { AnalyticsRepository } from '../src/analytics/analytics.repository';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { PrismaService } from '../src/prisma/prisma.service';

// Integration tests of the reports (TES-88) on a real Postgres: the state
// filter, the Argentina day cut and the zero filling live in SQL.

const userId = randomUUID();
const november = {
  from: '2026-11-01T00:00:00.000-03:00',
  to: '2026-11-30T23:59:59.999-03:00',
};

describe('ERP analytics against a real database', () => {
  let prisma: PrismaService;
  let service: AnalyticsService;
  let categoryId: string;
  let yerba: string;
  let queso: string;

  const product = async (
    name: string,
    price: number,
    stock: number,
    extra: {
      lowStockThreshold?: number;
      active?: boolean;
      deleted?: boolean;
    } = {},
  ) =>
    (
      await prisma.product.create({
        data: {
          name,
          sku: randomUUID(),
          price,
          stock,
          unit: 'Unit',
          categoryId,
          ...extra,
        },
      })
    ).id;

  // Inserted directly: these tests are about reading, so stock rules and
  // state transitions are bypassed on purpose
  const sale = (
    currentState: 'Ordered' | 'Paid' | 'Dispatched' | 'Cancelled',
    createdAt: string,
    items: { productId: string; quantity: number; unitPrice: number }[],
  ) =>
    prisma.sale.create({
      data: {
        userId,
        currentState,
        createdAt: new Date(createdAt),
        total: items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0),
        items: { create: items },
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PrismaService, AnalyticsRepository, AnalyticsService],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    service = moduleRef.get(AnalyticsService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE erp.stock_movements, erp.sale_history, erp.sale_items, erp.sales, erp.products, erp.categories RESTART IDENTITY CASCADE',
    );
    categoryId = (await prisma.category.create({ data: { name: 'Almacen' } }))
      .id;
    yerba = await product('Yerba', 1000, 20, { lowStockThreshold: 5 });
    queso = await product('Queso', 500, 3, { lowStockThreshold: 5 });

    // November, Argentina time (UTC-3)
    await sale('Paid', '2026-11-10T12:00:00-03:00', [
      { productId: yerba, quantity: 1, unitPrice: 1000 },
    ]);
    await sale('Dispatched', '2026-11-10T15:00:00-03:00', [
      { productId: queso, quantity: 1, unitPrice: 500 },
    ]);
    // 02:30 UTC on the 10th is still the 9th in Argentina
    await sale('Paid', '2026-11-10T02:30:00Z', [
      { productId: yerba, quantity: 2, unitPrice: 1000 },
    ]);
    // Last minutes of November in Argentina, already December in UTC
    await sale('Paid', '2026-12-01T02:30:00Z', [
      { productId: queso, quantity: 4, unitPrice: 100 },
    ]);
    // Not revenue
    await sale('Ordered', '2026-11-12T10:00:00-03:00', [
      { productId: yerba, quantity: 7, unitPrice: 100 },
    ]);
    await sale('Cancelled', '2026-11-12T11:00:00-03:00', [
      { productId: yerba, quantity: 3, unitPrice: 100 },
    ]);
    // Outside November: first instant of December in Argentina, and October
    await sale('Paid', '2026-12-01T03:00:00Z', [
      { productId: yerba, quantity: 1, unitPrice: 50 },
    ]);
    await sale('Paid', '2026-10-20T10:00:00-03:00', [
      { productId: queso, quantity: 1, unitPrice: 300 },
    ]);
  });

  it('summary counts only paid sales of the range, in Argentina time', async () => {
    const { current, previous } = await service.summary(november);

    // 1000 + 500 (Dispatched) + 2000 (the 9th, local) + 400 (the 30th, local)
    expect(current).toEqual({
      revenue: 3900,
      salesCount: 4,
      averageTicket: 975,
      unitsSold: 8,
      cancelledCount: 1,
    });
    // October 2 to 31: only the October sale
    expect(previous).toMatchObject({ revenue: 300, salesCount: 1 });
  });

  it('the daily series has one point per day, zeros included, cut in Argentina time', async () => {
    const { series } = await service.salesOverTime({
      ...november,
      groupBy: 'day',
    });

    expect(series).toHaveLength(30);
    expect(series[0].period).toBe('2026-11-01');
    expect(series.at(-1)?.period).toBe('2026-11-30');
    const byDay = Object.fromEntries(series.map((p) => [p.period, p]));
    expect(byDay['2026-11-09']).toEqual({
      period: '2026-11-09',
      revenue: 2000,
      salesCount: 1,
    });
    expect(byDay['2026-11-10']).toEqual({
      period: '2026-11-10',
      revenue: 1500,
      salesCount: 2,
    });
    expect(byDay['2026-11-30']).toEqual({
      period: '2026-11-30',
      revenue: 400,
      salesCount: 1,
    });
    expect(byDay['2026-11-12']).toEqual({
      period: '2026-11-12',
      revenue: 0,
      salesCount: 0,
    });
    // The series adds up to the summary
    expect(series.reduce((sum, p) => sum + p.revenue, 0)).toBe(3900);
  });

  it('weeks start on Monday and months are labelled YYYY-MM', async () => {
    const weeks = await service.salesOverTime({ ...november, groupBy: 'week' });
    expect(weeks.series.map((p) => p.period)).toEqual([
      '2026-10-26',
      '2026-11-02',
      '2026-11-09',
      '2026-11-16',
      '2026-11-23',
      '2026-11-30',
    ]);
    expect(weeks.series.find((p) => p.period === '2026-11-09')?.revenue).toBe(
      3500,
    );

    const months = await service.salesOverTime({
      from: '2026-10-01T00:00:00.000-03:00',
      to: november.to,
      groupBy: 'month',
    });
    expect(months.series).toEqual([
      { period: '2026-10', revenue: 300, salesCount: 1 },
      { period: '2026-11', revenue: 3900, salesCount: 4 },
    ]);
  });

  it('top products rank paid units, using the price of each sale', async () => {
    const { items } = await service.topProducts({ ...november, limit: 10 });

    // Queso sells more units (5) although Yerba brings more revenue
    expect(
      items.map(({ productId, name, unitsSold, revenue }) => ({
        productId,
        name,
        unitsSold,
        revenue,
      })),
    ).toEqual([
      { productId: queso, name: 'Queso', unitsSold: 5, revenue: 900 },
      { productId: yerba, name: 'Yerba', unitsSold: 3, revenue: 3000 },
    ]);
  });

  it('inventory value counts every product not deleted, paused ones included', async () => {
    await product('Pausado', 10, 10, { active: false });
    await product('Borrado', 99999, 999, { deleted: true });
    await product('Sin stock', 10, 0);

    // 20 x 1000 + 3 x 500 + 10 x 10 + 0
    await expect(service.inventoryValue()).resolves.toEqual({
      totalValuation: 21600,
      totalUnits: 33,
      lowStockCount: 1,
      outOfStockCount: 1,
      activeProducts: 3,
    });
  });
});
