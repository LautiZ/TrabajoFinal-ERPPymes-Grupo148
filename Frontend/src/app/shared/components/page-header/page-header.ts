import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Encabezado estándar de página: título, subtítulo y acciones (contenido proyectado). */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <div class="page-header__text">
        @if (eyebrow()) {
          <p class="app-eyebrow">{{ eyebrow() }}</p>
        }
        <h1>{{ title() }}</h1>
        @if (subtitle()) {
          <p class="page-header__subtitle">{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: 1.5rem;
    }
    .page-header {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      justify-content: space-between;
      gap: 1rem;
    }
    .page-header__text p {
      margin: 0;
    }
    h1 {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-headline-medium);
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .page-header__subtitle {
      margin-top: 0.25rem;
      color: var(--app-text-muted);
    }
    .page-header__actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .page-header__actions:empty {
      display: none;
    }
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly eyebrow = input<string>('');
}
