import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { StockConflict } from '../../models/stock-conflict.model';

export interface StockConflictDialogData {
  conflicts: StockConflict[];
}

/** `adjust`: ajustar al stock disponible; `review`: volver al carrito a corregir a mano. */
export type StockConflictDialogResult = 'adjust' | 'review';

@Component({
  selector: 'app-stock-conflict-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Stock insuficiente</h2>
    <mat-dialog-content>
      <p>El stock cambió mientras armabas la venta. Estos productos ya no alcanzan:</p>
      <ul>
        @for (conflict of data.conflicts; track conflict.productId) {
          <li>
            <strong>{{ conflict.name }}</strong
            >: pediste {{ conflict.requested }},
            @if (conflict.available > 0) {
              disponible {{ conflict.available }}.
            } @else {
              sin stock.
            }
          </li>
        }
      </ul>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close('review')">Revisar carrito</button>
      <button mat-flat-button type="button" (click)="close('adjust')">
        Ajustar al stock disponible
      </button>
    </mat-dialog-actions>
  `,
})
export class StockConflictDialog {
  private readonly dialogRef =
    inject<MatDialogRef<StockConflictDialog, StockConflictDialogResult>>(MatDialogRef);
  protected readonly data = inject<StockConflictDialogData>(MAT_DIALOG_DATA);

  protected close(result: StockConflictDialogResult): void {
    this.dialogRef.close(result);
  }
}
