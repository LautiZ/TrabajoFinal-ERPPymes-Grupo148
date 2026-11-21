import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { Observable, map, of, switchMap, tap, throwError } from 'rxjs';
import { ClipboardService } from '../../../../core/services/clipboard.service';
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
import { PurchaseSnapshotService } from '../../services/purchase-snapshot.service';
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
    MatIconModule,
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
  private readonly clipboard = inject(ClipboardService);
  private readonly purchases = inject(PurchaseSnapshotService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly unitLabels = UNIT_LABELS;
  protected readonly lineTotal = lineTotal;
  protected readonly submitting = signal(false);
  /** Link de Mercado Pago ya generado: el cliente lo abre y paga desde su propio dispositivo. */
  protected readonly paymentLink = signal<string | null>(null);
  /** Pasa a `true` un instante después de copiar el link, para confirmarlo en el botón. */
  protected readonly copied = signal(false);
  /** Id de la venta del pago generado (para consultar su estado). */
  protected readonly saleId = signal<string | null>(null);
  private copiedTimer: ReturnType<typeof setTimeout> | undefined;

  /** Venta ya creada en este checkout: un reintento de pago no debe duplicarla. */
  private pendingSale: Sale | null = null;

  /** Solo el método de pago: el backend arma el cobro a partir de la venta (no pide datos del cliente). */
  protected readonly form = this.fb.group({
    paymentMethod: this.fb.control<PaymentMethod>('mercadopago', Validators.required),
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.copiedTimer));
  }

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
        next: (checkoutUrl) => this.showLink(checkoutUrl),
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

  /** Muestra el link para que el cliente pague; no se redirige a Mercado Pago desde acá. */
  private showLink(checkoutUrl: string | null): void {
    try {
      this.paymentLink.set(this.payments.validCheckoutUrl(checkoutUrl));
      this.saleId.set(this.pendingSale?.id ?? null);
      this.rememberPurchase();
      this.submitting.set(false);
    } catch (error) {
      this.handleError(error);
    }
  }

  /** Guarda el detalle para la pantalla pública "Gracias por su compra" (mismo navegador). */
  private rememberPurchase(): void {
    const sale = this.pendingSale;
    if (!sale) {
      return;
    }
    this.purchases.save({
      saleId: sale.id,
      items: this.cart.items().map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit })),
      total: sale.total || this.cart.total(),
      createdAt: Date.now(),
    });
  }

  protected async copyLink(link: string): Promise<void> {
    if (await this.clipboard.copy(link)) {
      this.notify.success('Link de pago copiado al portapapeles.');
      this.copied.set(true);
      clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copied.set(false), 2500);
    } else {
      this.notify.error('No se pudo copiar. Seleccioná el link y copialo manualmente.');
    }
  }

  /** La venta ya está registrada: se limpia el carrito y se vuelve al punto de venta. */
  protected newSale(): void {
    this.cart.clear();
    this.payments.clearPendingSale();
    void this.router.navigate(['/sales']);
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
