import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_URL } from '../../../core/services/api.service';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsSummaryResponse,
  InventoryValuationResponse,
  SalesOverTimeResponse,
  TopProductsResponse,
} from '../models/analytics.model';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let httpMock: HttpTestingController;
  const mockBaseUrl = 'http://localhost:3000/api';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_URL, useValue: mockBaseUrl },
        AnalyticsService,
      ],
    });

    service = TestBed.inject(AnalyticsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should update shared filter signal correctly', () => {
    service.updateDateRange('2026-10-01', '2026-10-31', 'previousMonth');
    service.updateGroupBy('week');

    expect(service.from()).toBe('2026-10-01');
    expect(service.to()).toBe('2026-10-31');
    expect(service.groupBy()).toBe('week');
    expect(service.filter().preset).toBe('previousMonth');
  });

  it('should format dates to ISO preserving local timezone offset', () => {
    const startIso = service.toIsoWithLocalTimezone('2026-11-01', false);
    const endIso = service.toIsoWithLocalTimezone('2026-11-06', true);

    expect(startIso).toMatch(/^2026-11-01T00:00:00\.000[+-]\d{2}:\d{2}$/);
    expect(endIso).toMatch(/^2026-11-06T23:59:59\.999[+-]\d{2}:\d{2}$/);
  });

  it('should call getSummary with ISO date parameters and map response', () => {
    const mockResponse: AnalyticsSummaryResponse = {
      current: { revenue: 150000, salesCount: 30, averageTicket: 5000, unitsSold: 95 },
      previous: { revenue: 120000, salesCount: 25, averageTicket: 4800, unitsSold: 80 },
    };

    service.getSummary('2026-11-01', '2026-11-06').subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne((r) => r.url === `${mockBaseUrl}/analytics/summary`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toContain('2026-11-01T00:00:00.000');
    expect(req.request.params.get('to')).toContain('2026-11-06T23:59:59.999');
    req.flush(mockResponse);
  });

  it('should call getSalesOverTime with from, to and groupBy params', () => {
    const mockResponse: SalesOverTimeResponse = {
      groupBy: 'month',
      series: [{ period: '2026-11', revenue: 150000, salesCount: 30 }],
    };

    service.getSalesOverTime('2026-11-01', '2026-11-30', 'month').subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne((r) => r.url === `${mockBaseUrl}/analytics/sales-over-time`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('groupBy')).toBe('month');
    req.flush(mockResponse);
  });

  it('should call getTopProducts with date range and limit', () => {
    const mockResponse: TopProductsResponse = {
      items: [{ productId: 'p1', name: 'Producto A', unitsSold: 50, revenue: 50000 }],
    };

    service.getTopProducts('2026-11-01', '2026-11-30', 5).subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne((r) => r.url === `${mockBaseUrl}/analytics/top-products`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush(mockResponse);
  });

  it('should call getInventoryValue endpoint', () => {
    const mockResponse: InventoryValuationResponse = {
      totalValuation: 850000,
      totalUnits: 340,
      lowStockCount: 4,
    };

    service.getInventoryValue().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpMock.expectOne(`${mockBaseUrl}/analytics/inventory-value`);
    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });
});