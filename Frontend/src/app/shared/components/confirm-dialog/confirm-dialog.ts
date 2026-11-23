import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Paints the confirm button red for irreversible or sensitive actions. */
  destructive?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  host: { '[class.confirm-dialog--danger]': 'data.destructive' },
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        {{ data.cancelText || 'Cancelar' }}
      </button>
      <button
        mat-flat-button
        color="primary"
        [class.confirm-dialog__confirm--danger]="data.destructive"
        (click)="onConfirm()"
      >
        {{ data.confirmText || 'Aceptar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    /* The host fills the dialog surface, so its border frames the whole popup. */
    :host(.confirm-dialog--danger) {
      display: block;
      border: 1px solid color-mix(in srgb, var(--app-danger) 45%, transparent);
      border-radius: inherit;
    }

    /* Evita que mensajes largos sin espacios desborden el dialogo en phones. */
    mat-dialog-content p {
      overflow-wrap: anywhere;
    }

    .confirm-dialog__confirm--danger {
      --mat-sys-primary: var(--app-danger);
      --mat-sys-on-primary: var(--app-bg);
    }
  `,
})
export class ConfirmDialog {
  readonly dialogRef = inject(MatDialogRef<ConfirmDialog>);
  readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
