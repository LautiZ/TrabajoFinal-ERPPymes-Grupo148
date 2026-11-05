import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  InjectionToken,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap, takeWhile, timer } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { PaymentsService } from '../../services/payments.service';
import { SalesService } from '../../services/sales.service';
import {
  ResultStatus,
  resolvePaymentStatus,
  statusFromReturnParam,
} from '../../utils/payment-status';

export interface PaymentPollConfig {
  intervalMs: number;
  maxAttempts: number;
}

/** Polling corto mientras el pago está pendiente de confirmación por webhook. */
export const PAYMENT_POLL_CONFIG = new InjectionToken<PaymentPollConfig>('PAYMENT_POLL_CONFIG', {
  providedIn: 'root',
  factory: () => ({ intervalMs: 3000, maxAttempts: 10 }),
});

@Component({
  selector: 'app-payment-result',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './payment-result.html',
  styleUrl: './payment-result.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentResult {
  private readonly route = inject(ActivatedRoute);
  private readonly sales = inject(SalesService);
  private readonly payments = inject(PaymentsService);
  private readonly cart = inject(CartService);
  private readonly poll = inject(PAYMENT_POLL_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  /** Qué informó Mercado Pago en la URL de retorno (solo como pista visual). */
  protected readonly returnHint = statusFromReturnParam(this.route.snapshot.paramMap.get('result'));
  protected readonly saleId =
    this.route.snapshot.queryParamMap.get('external_reference') ?? this.payments.pendingSaleId();

  /** `null` mientras no hay una respuesta del backend. */
  protected readonly status = signal<ResultStatus | null>(null);
  /** El backend siguió pendiente tras agotar los reintentos del polling. */
  protected readonly timedOut = signal(false);
  protected readonly verificationFailed = signal(false);

  constructor() {
    const saleId = this.saleId;
    if (!saleId) {
      this.verificationFailed.set(true);
      return;
    }
    this.watch(saleId);
  }

  private watch(saleId: string): void {
    let attempts = 0;
    timer(0, this.poll.intervalMs)
      .pipe(
        switchMap(() =>
          forkJoin({
            sale: this.sales.getSale(saleId).pipe(catchError(() => of(null))),
            payment: this.payments.getPaymentBySale(saleId).pipe(catchError(() => of(null))),
          }),
        ),
        map(({ sale, payment }) => ({
          // Sin respuesta de ninguno de los dos: no se sabe nada, no se asume "pendiente".
          unknown: sale === null && payment === null,
          status: resolvePaymentStatus(sale, payment),
        })),
        takeWhile((result) => {
          attempts += 1;
          const keepPolling =
            (result.unknown || result.status === 'pending') && attempts < this.poll.maxAttempts;
          if (!keepPolling) {
            if (result.unknown) {
              this.verificationFailed.set(true);
            } else if (result.status === 'pending') {
              this.timedOut.set(true);
            }
          }
          return keepPolling;
        }, true),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ unknown, status }) => {
        if (unknown) {
          return;
        }
        this.status.set(status);
        if (status === 'approved') {
          this.cart.clear();
          this.payments.clearPendingSale();
        }
      });
  }
}
