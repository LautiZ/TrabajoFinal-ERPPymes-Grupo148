import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Tarjeta de indicador (KPI): etiqueta, valor destacado, ícono y nota al pie. */
@Component({
  selector: 'app-stat-card',
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="app-card stat" [class.stat--danger]="tone() === 'danger'">
      <header class="stat__top">
        <h2 class="app-eyebrow">{{ label() }}</h2>
        @if (icon()) {
          <span class="stat__icon" aria-hidden="true">
            <mat-icon fontSet="material-symbols-outlined">{{ icon() }}</mat-icon>
          </span>
        }
      </header>
      <p class="stat__value">{{ value() }}</p>
      @if (hint()) {
        <p class="stat__hint">{{ hint() }}</p>
      }
    </article>
  `,
  styles: `
    :host {
      display: block;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      height: 100%;
    }
    .stat__top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    h2 {
      margin: 0;
    }
    .stat__icon {
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.75rem;
      background: var(--app-surface-3);
      color: var(--app-accent);
    }
    .stat--danger .stat__icon {
      background: var(--app-danger-soft);
      color: var(--app-danger);
    }
    .stat__value {
      margin: 0;
      font: var(--mat-sys-display-small);
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .stat__hint {
      margin: 0;
      color: var(--app-text-muted);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class StatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly hint = input<string>('');
  readonly icon = input<string>('');
  readonly tone = input<'default' | 'danger'>('default');
}
