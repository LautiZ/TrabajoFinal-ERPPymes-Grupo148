import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { RouterLink } from '@angular/router';
import {
  ConfirmDialog,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog';
import { NotificationService } from '../../../../shared/services/notification.service';
import { AdjustStockDto, Product } from '../../models/product.model';
import { InventoryService } from '../../services/inventory.service';
import { extractErrorMessage } from '../../utils/api-error';
import {
  AdjustStockDialog,
  AdjustStockDialogData,
} from '../adjust-stock-dialog/adjust-stock-dialog';

/** Menú de acciones de una fila: editar, ajustar stock y eliminar. */
@Component({
  selector: 'app-product-actions',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="menu"
      [attr.aria-label]="'Acciones de ' + product().name"
    >
      <mat-icon fontSet="material-symbols-outlined">more_vert</mat-icon>
    </button>
    <mat-menu #menu="matMenu">
      <a mat-menu-item [routerLink]="['/inventory', product().id, 'edit']">
        <mat-icon fontSet="material-symbols-outlined">edit</mat-icon>
        <span>Editar</span>
      </a>
      <button mat-menu-item type="button" (click)="adjustStock()">
        <mat-icon fontSet="material-symbols-outlined">swap_vert</mat-icon>
        <span>Ajustar stock</span>
      </button>
      <button mat-menu-item type="button" (click)="remove()">
        <mat-icon fontSet="material-symbols-outlined">delete</mat-icon>
        <span>Eliminar</span>
      </button>
    </mat-menu>
  `,
})
export class ProductActions {
  private readonly dialog = inject(MatDialog);
  private readonly inventory = inject(InventoryService);
  private readonly notify = inject(NotificationService);

  readonly product = input.required<Product>();
  /** Se emite cuando una operación modificó el catálogo y la tabla debe refrescarse. */
  readonly changed = output<void>();

  protected adjustStock(): void {
    const product = this.product();
    this.dialog
      .open<AdjustStockDialog, AdjustStockDialogData, AdjustStockDto | undefined>(
        AdjustStockDialog,
        { data: { product } },
      )
      .afterClosed()
      .subscribe((dto) => {
        if (!dto) {
          return;
        }
        this.inventory.adjustStock(product.id, dto).subscribe({
          next: () => {
            this.notify.success(`Stock de "${product.name}" actualizado.`);
            this.changed.emit();
          },
          error: (error: unknown) =>
            this.notify.error(
              extractErrorMessage(error, 'No se pudo registrar el ajuste de stock.'),
            ),
        });
      });
  }

  protected remove(): void {
    const product = this.product();
    this.dialog
      .open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, {
        data: {
          title: 'Eliminar producto',
          message: `¿Eliminar "${product.name}"? Dejará de aparecer en el catálogo y en nuevas operaciones.`,
          confirmText: 'Eliminar',
          cancelText: 'Cancelar',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.inventory.delete(product.id).subscribe({
          next: () => {
            this.notify.success(`"${product.name}" fue eliminado.`);
            this.changed.emit();
          },
          error: (error: unknown) =>
            this.notify.error(extractErrorMessage(error, 'No se pudo eliminar el producto.')),
        });
      });
  }
}
