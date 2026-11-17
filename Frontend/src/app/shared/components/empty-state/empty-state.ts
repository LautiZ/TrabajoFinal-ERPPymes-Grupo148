import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Estado vacío estándar: ícono, mensaje y acción opcional (contenido proyectado). */
@Component({
  selector: 'app-empty-state',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="empty" role="status">
      <mat-icon fontSet="material-symbols-outlined" aria-hidden="true">{{ icon() }}</mat-icon>
      <p class="empty__title">{{ title() }}</p>
      @if (description()) {
        <p class="empty__description">{{ description() }}</p>
      }
      <ng-content />
    </div>
  `,
  styles: `
    .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      padding: 2.5rem 1rem;
      text-align: center;
      color: var(--app-text-muted);
    }
    mat-icon {
      width: 2.75rem;
      height: 2.75rem;
      font-size: 2.75rem;
    }
    p {
      margin: 0;
    }
    .empty__title {
      color: var(--app-text);
      font: var(--mat-sys-title-medium);
    }
  `,
})
export class EmptyState {
  readonly icon = input<string>('inbox');
  readonly title = input.required<string>();
  readonly description = input<string>('');
}
