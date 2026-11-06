import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DateRangeFilterComponent } from '../components/date-range-filter/date-range-filter';
import { KpiCardsComponent } from '../components/kpi-cards/kpi-cards';
import { SalesEvolutionChartComponent } from '../components/sales-evolution-chart/sales-evolution-chart';
import { TopProductsChartComponent } from '../components/top-products-chart/top-products-chart';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    DateRangeFilterComponent,
    KpiCardsComponent,
    SalesEvolutionChartComponent,
    TopProductsChartComponent,
  ],
  templateUrl: './analytics-dashboard.html',
  styleUrl: './analytics-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsDashboard {}