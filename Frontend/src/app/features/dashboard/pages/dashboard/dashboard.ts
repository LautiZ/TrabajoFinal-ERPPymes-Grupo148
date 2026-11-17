import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { StatCard } from '../../../../shared/components/stat-card/stat-card';

interface Indicator {
  label: string;
  icon: string;
  hint: string;
  tone?: 'default' | 'danger';
}

@Component({
  imports: [RouterLink, MatButtonModule, PageHeader, StatCard, EmptyState],
  selector: 'app-dashboard',
  styleUrl: './dashboard.scss',
  templateUrl: './dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {
  /** Indicadores del panel. Los valores se conectarán a los datos reales con el backend. */
  protected readonly indicators: readonly Indicator[] = [
    {
      label: 'Valor del inventario',
      icon: 'account_balance_wallet',
      hint: 'Disponible con el módulo de Inventario',
    },
    {
      label: 'Alertas de stock',
      icon: 'warning',
      hint: 'Productos bajo el mínimo',
      tone: 'danger',
    },
    { label: 'Ventas del mes', icon: 'payments', hint: 'Disponible con el módulo de Ventas' },
    { label: 'Ventas de hoy', icon: 'receipt_long', hint: 'Disponible con el módulo de Ventas' },
  ];
}
