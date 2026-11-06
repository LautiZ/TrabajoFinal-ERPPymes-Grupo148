import { Routes } from '@angular/router';

export const ANALYTICS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/analytics-dashboard').then(
        (m) => m.AnalyticsDashboard
      ),
  },
];