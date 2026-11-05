import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { Observable, of, switchMap, tap, throwError } from 'rxjs';
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
import { parseStockConflicts } from '../../utils/stock-conflict';

/** Rechaza valores vacíos o con solo espacios (`Validators.required` los dejaría pasar). */
const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length > 0 ? null : { required: true };

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
    MatFormFieldModule,
    MatInputModule,
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

  protected readonly form = this.fb.group({
    paymentMethod: this.fb.control<PaymentMethod>('mercadopago', Validators.required),
    customerName: this.fb.control('', [notBlank, Validators.maxLength(100)]),
    customerEmail: this.fb.control('', [
      Validators.required,
      Validators.email,
      Validators.maxLength(120),
    ]),
  });

  /**
   * El botón queda habilitado aunque el formulario sea inválido: al tocarlo se marcan los
   * campos con sus errores, así el usuario sabe qué falta (un botón apagado no lo explica).
   */
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
        next: (initPoint) => this.redirect(initPoint),
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

  private startPayment(sale: Sale): Observable<string> {
    const { customerName, customerEmail } = this.form.getRawValue();
    return this.payments
      .createPayment({
        saleId: sale.id,
        backUrls: this.payments.buildBackUrls(),
        payer: { name: customerName.trim(), email: customerEmail.trim() },
      })
      .pipe(switchMap((response) => of(response.initPoint)));
  }

  private redirect(initPoint: string): void {
    try {
      this.payments.redirectToCheckout(initPoint);
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
      this.notify.error(
        error instanceof Error && !('status' in error)
          ? error.message
          : 'No se pudo iniciar el pago. Intentá nuevamente.',
      );
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
