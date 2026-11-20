import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { Observable, map, of, switchMap, tap, throwError } from 'rxjs';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { NotificationService } from '../../../../shared/services/notification.service';
import {
  StockConflictDialog,
  StockConflictDialogData,
  StockConflictDialogResult,
} from '../../components/stock-conflict-dialog/stock-conflict-dialog';
import { PaymentMethod } from '../../models/payment.model';
import { Sale } from '../../models/sale.model';
import { StockConflict } from '../../models/stock-conflict.model';
import { UNIT_LABELS } from '../../models/product.model';
import { CartService, lineTotal } from '../../services/cart.service';
import { PaymentsService } from '../../services/payments.service';
import { SalesService } from '../../services/sales.service';
import { StockCheckService } from '../../services/stock-check.service';
import { isSaleNotPayable, paymentErrorMessage } from '../../utils/payment-errors';
import { parseStockConflicts } from '../../utils/stock-conflict';

/** Error interno: la verificación previa detectó ítems sin stock suficiente. */
class StockConflictError extends Error {
  constructor(readonly conflicts: StockConflict[]) {
    super('Stock insuficiente');
  }
}

@Component({
  selector: 'app-checkout',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    PageHeader,
  ],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Checkout {
  protected readonly cart = inject(CartService);
  private readonly sales = inject(SalesService);
  private readonly payments = inject(PaymentsService);
  private readonly stock = inject(StockCheckService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly lineTotal = lineTotal;
  protected readonly submitting = signal(false);

  /** Venta ya creada en este checkout: un reintento de pago no debe duplicarla. */
  private pendingSale: Sale | null = null;

  /** Solo el método de pago: el backend arma el cobro a partir de la venta (no pide datos del cliente). */
  protected readonly form = this.fb.group({
    paymentMethod: this.fb.control<PaymentMethod>('mercadopago', Validators.required),
  });

  protected canSubmit(): boolean {
    return !this.cart.isEmpty() && !this.submitting();
  }

  protected submit(): void {
    if (this.cart.isEmpty()) {
      this.notify.error('El carrito está vacío.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.stock
      .verify()
      .pipe(
        switchMap((conflicts) =>
          conflicts.length > 0
            ? throwError(() => new StockConflictError(conflicts))
            : this.ensureSale(),
        ),
        switchMap((sale) => this.startPayment(sale)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        // Se mantiene `submitting` activo: la página se abandona al redirigir a Mercado Pago.
        next: (checkoutUrl) => this.redirect(checkoutUrl),
        error: (error: unknown) => this.handleError(error),
      });
  }

  private ensureSale(): Observable<Sale> {
    if (this.pendingSale) {
      return of(this.pendingSale);
    }
    return this.sales.createSale(this.cart.items()).pipe(
      tap((sale) => {
        this.pendingSale = sale;
        this.payments.rememberPendingSale(sale.id);
      }),
    );
  }

  private startPayment(sale: Sale): Observable<string | null> {
    return this.payments.createPayment(sale.id).pipe(map((payment) => payment.checkoutUrl));
  }

  private redirect(checkoutUrl: string | null): void {
    try {
      this.payments.redirectToCheckout(checkoutUrl);
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): void {
    this.submitting.set(false);

    if (error instanceof StockConflictError) {
      this.showStockConflicts(error.conflicts);
      return;
    }

    const conflicts = parseStockConflicts(error);
    if (conflicts === null) {
      if (isSaleNotPayable(error)) {
        // La venta quedó cancelada o ya está paga: reintentar no sirve, hay que armar otra.
        this.pendingSale = null;
        this.payments.clearPendingSale();
      }
      this.notify.error(paymentErrorMessage(error));
      return;
    }

    // El backend rechazó la venta por stock; si no detalló ítems, se re-consulta el stock real.
    this.pendingSale = null;
    if (conflicts.length > 0) {
      this.showStockConflicts(conflicts);
      return;
    }
    this.stock
      .verify()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (found) =>
          found.length > 0
            ? this.showStockConflicts(found)
            : this.notify.error('No hay stock suficiente para completar la venta.'),
        error: () => this.notify.error('No hay stock suficiente para completar la venta.'),
      });
  }

  private showStockConflicts(conflicts: StockConflict[]): void {
    this.pendingSale = null;
    const named = this.stock.withNames(conflicts);
    this.dialog
      .open<StockConflictDialog, StockConflictDialogData, StockConflictDialogResult>(
        StockConflictDialog,
        { data: { conflicts: named }, disableClose: true },
      )
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((choice) => {
        if (choice === 'adjust') {
          this.stock.adjustToAvailable(named);
          this.notify.info(
            'Ajustamos las cantidades al stock disponible. Revisá y confirmá de nuevo.',
          );
          if (this.cart.isEmpty()) {
            void this.router.navigate(['/sales']);
          }
        } else {
          void this.router.navigate(['/sales']);
        }
      });
  }
}
