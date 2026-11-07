import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { HOME_PATH } from '../../../../core/auth-paths';

/** Se muestra cuando el usuario tiene sesión pero su rol no alcanza para la ruta pedida. */
@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, MatButtonModule, PageHeader, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header eyebrow="Acceso" title="Acceso denegado" />
    <section class="app-card">
      <app-empty-state
        icon="lock"
        title="No tenés permisos para ver esta pantalla"
        description="Tu rol no incluye este módulo. Si creés que es un error, pedile acceso al administrador."
      >
        <a mat-flat-button [routerLink]="homePath">Volver al panel</a>
      </app-empty-state>
    </section>
  `,
})
export class AccessDenied {
  protected readonly homePath = HOME_PATH;
}
