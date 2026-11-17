import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { LoadingSpinner } from '../../shared/components/loading-spinner/loading-spinner';
import { NotificationService } from '../../shared/services/notification.service';

@Component({
  selector: 'app-ui-demo',
  imports: [MatButtonModule, LoadingSpinner],
  template: `
    <div
      style="padding: 2rem; max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;"
    >
      <h1>UI Showcase — Componentes Base</h1>

      <section>
        <h2>Botones y Notificaciones</h2>
        <div style="display: flex; gap: 1rem;">
          <button mat-flat-button color="primary" (click)="showSuccess()">
            Notificación Éxito
          </button>
          <button mat-stroked-button color="warn" (click)="showError()">Notificación Error</button>
        </div>
      </section>

      <section>
        <h2>Diálogo de Confirmación</h2>
        <button mat-flat-button color="accent" (click)="openDialog()">Abrir Diálogo</button>
      </section>

      <section>
        <h2>Spinner / Loader</h2>
        <app-loading-spinner [diameter]="48" message="Cargando catálogo..."></app-loading-spinner>
      </section>
    </div>
  `,
})
export class UiDemo {
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  showSuccess(): void {
    this.notify.success('Operación realizada con éxito');
  }

  showError(): void {
    this.notify.error('Ocurrió un error inesperado');
  }

  openDialog(): void {
    const ref = this.dialog.open(ConfirmDialog, {
      data: {
        title: 'Confirmar eliminación',
        message: '¿Estás seguro de pausar este producto del catálogo?',
        confirmText: 'Confirmar',
        cancelText: 'Volver',
      },
    });

    ref.afterClosed().subscribe((result: boolean) => {
      if (result) {
        this.notify.success('Acción confirmada');
      }
    });
  }
}
