import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TopProductsChartComponent } from './top-products-chart';
import { AnalyticsService } from '../../services/analytics.service';
import { TopProductsResponse } from '../../models/analytics.model';

describe('TopProductsChartComponent', () => {
  let component: TopProductsChartComponent;
  let fixture: ComponentFixture<TopProductsChartComponent>;
  let analyticsServiceMock: {
    getTopProducts: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
  };

  const mockResponse: TopProductsResponse = {
    items: [
      { productId: 'p1', name: 'Producto A', unitsSold: 20, revenue: 100000 },
      { productId: 'p2', name: 'Producto B', unitsSold: 15, revenue: 75000 },
    ],
  };

  beforeEach(async () => {
    analyticsServiceMock = {
      getTopProducts: vi.fn().mockReturnValue(of(mockResponse)),
      from: vi.fn().mockReturnValue('2026-11-01'),
      to: vi.fn().mockReturnValue('2026-11-06'),
    };

    await TestBed.configureTestingModule({
      imports: [TopProductsChartComponent],
      providers: [{ provide: AnalyticsService, useValue: analyticsServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(TopProductsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(analyticsServiceMock.getTopProducts).toHaveBeenCalled();
  });

  it('should load top products and render list content', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="top-products-content"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="top-products-list"]')).not.toBeNull();
  });

  it('should handle error state and allow retry', () => {
    analyticsServiceMock.getTopProducts.mockReturnValue(throwError(() => new Error('Error')));
    component.retry();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="top-products-error"]')).not.toBeNull();
  });

  it('should display empty state when items list is empty', () => {
    analyticsServiceMock.getTopProducts.mockReturnValue(of({ items: [] }));
    component.loadTopProducts('2026-11-01', '2026-11-06');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="top-products-empty"]')).not.toBeNull();
  });

  it('should change metric between revenue and units', () => {
    component.setMetric('units');
    expect(component['metric']()).toBe('units');
  });
});