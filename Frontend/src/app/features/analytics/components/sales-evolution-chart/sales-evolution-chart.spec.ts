import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SalesEvolutionChartComponent } from './sales-evolution-chart';
import { AnalyticsService } from '../../services/analytics.service';
import { SalesOverTimeResponse } from '../../models/analytics.model';

describe('SalesEvolutionChartComponent', () => {
  let component: SalesEvolutionChartComponent;
  let fixture: ComponentFixture<SalesEvolutionChartComponent>;
  let analyticsServiceMock: {
    getSalesOverTime: ReturnType<typeof vi.fn>;
    updateGroupBy: ReturnType<typeof vi.fn>;
    from: ReturnType<typeof vi.fn>;
    to: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };

  const mockResponse: SalesOverTimeResponse = {
    groupBy: 'day',
    series: [
      { period: '2026-11-01', revenue: 50000, salesCount: 5 },
      { period: '2026-11-02', revenue: 80000, salesCount: 8 },
    ],
  };

  beforeEach(async () => {
    analyticsServiceMock = {
      getSalesOverTime: vi.fn().mockReturnValue(of(mockResponse)),
      updateGroupBy: vi.fn(),
      from: vi.fn().mockReturnValue('2026-11-01'),
      to: vi.fn().mockReturnValue('2026-11-06'),
      groupBy: vi.fn().mockReturnValue('day'),
    };

    await TestBed.configureTestingModule({
      imports: [SalesEvolutionChartComponent],
      providers: [{ provide: AnalyticsService, useValue: analyticsServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(SalesEvolutionChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(analyticsServiceMock.getSalesOverTime).toHaveBeenCalled();
  });

  it('should load series data successfully and display chart container', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="evolution-chart-container"]')).not.toBeNull();
    expect(compiled.querySelector('[data-testid="evolution-loading"]')).toBeNull();
  });

  it('should handle error state and allow retry', () => {
    analyticsServiceMock.getSalesOverTime.mockReturnValue(throwError(() => new Error('Error')));
    component.retry();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="evolution-error"]')).not.toBeNull();
  });

  it('should display empty state when series is empty', () => {
    analyticsServiceMock.getSalesOverTime.mockReturnValue(of({ groupBy: 'day', series: [] }));
    component.loadSeries('2026-11-01', '2026-11-06', 'day');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('[data-testid="evolution-empty"]')).not.toBeNull();
  });

  it('should change group by calling service updateGroupBy', () => {
    component.changeGroupBy('week');
    expect(analyticsServiceMock.updateGroupBy).toHaveBeenCalledWith('week');
  });

  it('should toggle chart type between line and bar', () => {
    component.toggleChartType('bar');
    expect(component['chartType']()).toBe('bar');
  });
});