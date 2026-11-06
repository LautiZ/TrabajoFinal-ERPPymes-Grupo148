import { Routes } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    providers: [provideCharts(withDefaultRegisterables())],
    loadComponent: () =>
      import('./pages/analytics-dashboard').then((m) => m.AnalyticsDashboard),
  },
];