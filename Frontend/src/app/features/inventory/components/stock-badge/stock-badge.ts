import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { STOCK_STATUS_LABELS, StockStatus } from '../../utils/stock-status';

const ICONS: Record<StockStatus, string> = {
  ok: 'check_circle',
  low: 'warning',
  out: 'error',
};

/** Etiqueta de estado de stock. No depende solo del color: lleva ícono y texto. */
@Component({
  selector: 'app-stock-badge',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge badge--' + status()">
      <mat-icon fontSet="material-symbols-outlined" aria-hidden="true">{{ icon() }}</mat-icon>
      {{ label() }}
    </span>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.1rem 0.55rem 0.1rem 0.35rem;
      border-radius: 999px;
      font: var(--mat-sys-label-small);
      font-weight: 600;
      white-space: nowrap;
    }
    mat-icon {
      width: 1rem;
      height: 1rem;
      font-size: 1rem;
    }
    .badge--ok {
      color: var(--app-success);
      background: color-mix(in srgb, var(--app-success) 16%, transparent);
    }
    .badge--low {
      color: var(--app-warning);
      background: color-mix(in srgb, var(--app-warning) 16%, transparent);
    }
    .badge--out {
      color: var(--app-danger);
      background: var(--app-danger-soft);
    }
  `,
})
export class StockBadge {
  readonly status = input.required<StockStatus>();

  protected label(): string {
    return STOCK_STATUS_LABELS[this.status()];
  }

  protected icon(): string {
    return ICONS[this.status()];
  }
}
