import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { NotificationService } from '../../../../shared/services/notification.service';
import { PaymentState } from '../../models/payment.model';
import { SALE_STATE_LABELS, SaleDetail } from '../../models/sale.model';
import { PaymentsService } from '../../services/payments.service';
import { SalesService } from '../../services/sales.service';

const PAYMENT_STATE_LABELS: Record<PaymentState, string> = {
  Pending: 'pendiente',
  Paid: 'aprobado',
  Rejected: 'rechazado',
  Refunded: 'reembolsado',
};

/** Estado del link de pago dentro del popup. */
type PaymentLink =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error' }
  | { kind: 'closed'; state: PaymentState }
  | { kind: 'open'; url: string };

export interface SaleDetailDialogData {
  sale: SaleDetail;
}

/**
 * Detalle de una venta. Los únicos cambios de estado manuales son:
 * Ordered -> Cancelled (devuelve el stock) y Paid -> Dispatched.
 * Se cierra con la venta actualizada cuando hubo un cambio.
 */
@Component({
  selector: 'app-sale-detail-dialog',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, MatButtonModule, MatDialogModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
      gap: 0.75rem 1.5rem;
      margin: 0 0 1.25rem;
    }
    .summary dt {
      font: var(--mat-sys-label-small);
      color: var(--app-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .summary dd {
      margin: 0.15rem 0 0;
      font: var(--mat-sys-body-large);
    }
    h3 {
      margin: 1rem 0 0.5rem;
      font: var(--mat-sys-title-small);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 0.4rem 0.5rem;
      text-align: left;
      border-bottom: 1px solid var(--app-border);
    }
    th {
      font: var(--mat-sys-label-small);
      color: var(--app-text-muted);
      text-transform: uppercase;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .muted {
      color: var(--app-text-muted);
    }
    .history {
      margin: 0;
      padding-left: 1.25rem;
    }
    .danger {
      --mat-button-filled-container-color: var(--app-danger);
      --mat-button-filled-label-text-color: #2a0d0d;
    }
    .payment-link {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.25rem 0.25rem 0.75rem;
      background: var(--app-surface-3);
      border: 1px solid var(--app-border);
      border-radius: 0.5rem;
    }
    .payment-link__url {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: var(--mat-sys-body-medium);
    }
    .hint {
      margin: 1rem 0 0;
      color: var(--app-text-muted);
    }
  `,
  template: `
    <h2 mat-dialog-title>Venta #{{ sale().saleNumber }}</h2>
    <mat-dialog-content>
      <dl class="summary">
        <div>
          <dt>Estado</dt>
          <dd>{{ stateLabels[sale().currentState] }}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{{ sale().createdAt | date: 'dd/MM/yyyy HH:mm' }}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{{ sale().total | currency: 'ARS' : 'symbol-narrow' }}</dd>
        </div>
        <div>
          <dt>Comprobante</dt>
          <dd>{{ sale().receiptNumber ?? '—' }}</dd>
        </div>
      </dl>

      <h3>Productos</h3>
      <table>
        <thead>
          <tr>
            <th>Producto</th>
            <th>SKU</th>
            <th class="num">Cantidad</th>
            <th class="num">Precio unit.</th>
            <th class="num">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          @for (item of sale().items; track item.productId) {
            <tr>
              <td>{{ item.name }}</td>
              <td class="muted">{{ item.sku }}</td>
              <td class="num">{{ item.quantity | number: '1.0-3' }}</td>
              <td class="num">{{ item.unitPrice | currency: 'ARS' : 'symbol-narrow' }}</td>
              <td class="num">{{ item.subtotal | currency: 'ARS' : 'symbol-narrow' }}</td>
            </tr>
          }
        </tbody>
      </table>

      <h3>Link de pago</h3>
      @switch (paymentLink().kind) {
        @case ('loading') {
          <p class="muted">Buscando el link de pago...</p>
        }
        @case ('none') {
          <p class="muted">Todavía no se generó un link de pago para esta venta.</p>
        }
        @case ('error') {
          <p class="muted">No se pudo obtener el link de pago.</p>
        }
        @case ('closed') {
          <p class="muted">El link ya no está disponible: el pago está {{ closedPaymentLabel() }}.</p>
        }
        @case ('open') {
          <div class="payment-link">
            <span class="payment-link__url" [title]="openUrl()">{{ openUrl() }}</span>
            <button
              mat-icon-button
              type="button"
              aria-label="Copiar link de pago"
              title="Copiar link de pago"
              (click)="copyLink()"
            >
              <mat-icon fontSet="material-symbols-outlined">content_copy</mat-icon>
            </button>
            <a
              mat-icon-button
              [href]="openUrl()"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir link de pago en una pestaña nueva"
              title="Abrir link de pago"
            >
              <mat-icon fontSet="material-symbols-outlined">open_in_new</mat-icon>
            </a>
          </div>
        }
      }

      <h3>Historial de estados</h3>
      <ol class="history">
        @for (step of sale().history; track step.state) {
          <li>
            {{ stateLabels[step.state] }} —
            <span class="muted">{{ step.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
          </li>
        }
      </ol>

      @if (sale().currentState === 'Dispatched' || sale().currentState === 'Cancelled') {
        <p class="hint">Esta venta está cerrada: ya no admite cambios de estado.</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="saving()" (click)="close()">Cerrar</button>
      @if (sale().currentState === 'Ordered') {
        <button
          mat-flat-button
          type="button"
          class="danger"
          [disabled]="saving()"
          (click)="cancelSale()"
        >
          Cancelar venta
        </button>
      }
      @if (sale().currentState === 'Paid') {
        <button mat-flat-button type="button" [disabled]="saving()" (click)="dispatchSale()">
          Marcar como despachada
        </button>
      }
    </mat-dialog-actions>
  `,
})
export class SaleDetailDialog {
  private readonly dialogRef = inject<MatDialogRef<SaleDetailDialog, SaleDetail>>(MatDialogRef);
  private readonly salesService = inject(SalesService);
  private readonly notify = inject(NotificationService);
  private readonly payments = inject(PaymentsService);
  private readonly clipboard = inject(Clipboard);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly stateLabels = SALE_STATE_LABELS;
  protected readonly sale = signal(inject<SaleDetailDialogData>(MAT_DIALOG_DATA).sale);
  protected readonly saving = signal(false);
  protected readonly paymentLink = signal<PaymentLink>({ kind: 'loading' });
  private changed = false;

  constructor() {
    this.payments
      .getPaymentBySale(this.sale().id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (payment) => this.paymentLink.set(this.toPaymentLink(payment)),
        error: () => this.paymentLink.set({ kind: 'error' }),
      });
  }

  protected openUrl(): string {
    const link = this.paymentLink();
    return link.kind === 'open' ? link.url : '';
  }

  protected closedPaymentLabel(): string {
    const link = this.paymentLink();
    return link.kind === 'closed' ? PAYMENT_STATE_LABELS[link.state] : '';
  }

  protected copyLink(): void {
    if (this.clipboard.copy(this.openUrl())) {
      this.notify.success('Link de pago copiado al portapapeles.');
    } else {
      this.notify.error('No se pudo copiar el link.');
    }
  }

  private toPaymentLink(
    payment: { state: PaymentState; checkoutUrl: string | null } | null,
  ): PaymentLink {
    if (!payment) {
      return { kind: 'none' };
    }
    if (!payment.checkoutUrl) {
      return { kind: 'closed', state: payment.state };
    }
    try {
      // Solo se muestra si es https y de Mercado Pago
      return { kind: 'open', url: this.payments.validCheckoutUrl(payment.checkoutUrl) };
    } catch {
      return { kind: 'error' };
    }
  }

  protected cancelSale(): void {
    this.apply(
      this.salesService.cancelSale(this.sale().id),
      'Venta cancelada. El stock fue devuelto.',
    );
  }

  protected dispatchSale(): void {
    this.apply(
      this.salesService.dispatchSale(this.sale().id),
      'Venta marcada como despachada.',
    );
  }

  protected close(): void {
    this.dialogRef.close(this.changed ? this.sale() : undefined);
  }

  private refresh(): void {
    this.salesService.getSaleDetail(this.sale().id).subscribe((sale) => {
      this.changed = true;
      this.sale.set(sale);
    });
  }

  private apply(request: Observable<SaleDetail>, successMessage: string): void {
    this.saving.set(true);
    request.subscribe({
      next: (updated) => {
        this.changed = true;
        this.sale.set(updated);
        this.saving.set(false);
        this.notify.success(successMessage);
        this.close();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse && err.status === 409) {
          // Otro usuario o el pago la movió: se muestra el estado real
          this.notify.error('La venta cambió de estado mientras la editabas.');
          this.refresh();
          return;
        }
        this.notify.error('No se pudo actualizar la venta.');
      },
    });
  }
}
