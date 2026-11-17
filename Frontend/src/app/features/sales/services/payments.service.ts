import { DOCUMENT } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import {
  CreatePaymentRequest,
  CreatePaymentResponse,
  Payment,
  PaymentBackUrls,
  PaymentState,
} from '../models/payment.model';
import { CART_STORAGE } from './cart.service';

export const PENDING_SALE_KEY = 'erp.sales.pending-sale.v1';

/** Solo se redirige a estos dominios (y sus subdominios), aunque el backend devuelva otra URL. */
const ALLOWED_REDIRECT_DOMAINS = [
  'mercadopago.com',
  'mercadopago.com.ar',
  'mercadopago.com.br',
  'mercadopago.com.mx',
  'mercadopago.cl',
  'mercadopago.com.co',
  'mercadopago.com.pe',
  'mercadopago.com.uy',
  'mercadolibre.com',
  'mercadolibre.com.ar',
];

function isAllowedRedirectHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_REDIRECT_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

interface ApiCreatePayment {
  initPoint?: string;
  init_point?: string;
  paymentId?: string;
}

interface ApiPayment {
  id: string;
  saleId: string;
  paymentState: PaymentState;
  amount: number | string;
}

/**
 * Comunicación con el Payments MS (vía API Gateway). Nunca maneja el Access Token
 * de Mercado Pago: el backend es el único que lo conoce.
 */
@Injectable({
  providedIn: 'root',
})
export class PaymentsService {
  private readonly api = inject(ApiService);
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(CART_STORAGE);

  /** URLs a las que Mercado Pago devuelve al usuario, relativas al origen de la app. */
  buildBackUrls(): PaymentBackUrls {
    const origin = this.document.location.origin;
    return {
      success: `${origin}/sales/payment/success`,
      failure: `${origin}/sales/payment/failure`,
      pending: `${origin}/sales/payment/pending`,
    };
  }

  createPayment(request: CreatePaymentRequest): Observable<CreatePaymentResponse> {
    return this.api.post<ApiCreatePayment>('payments', request).pipe(
      map((raw) => {
        const initPoint = raw.initPoint ?? raw.init_point;
        if (!initPoint) {
          throw new Error('El servidor no devolvió la URL de pago.');
        }
        return { initPoint, paymentId: raw.paymentId };
      }),
    );
  }

  /** Pago asociado a una venta; null si todavía no existe (404). */
  getPaymentBySale(saleId: string): Observable<Payment | null> {
    return this.api.get<ApiPayment>(`payments/sale/${encodeURIComponent(saleId)}`).pipe(
      map((raw) => ({ ...raw, amount: Number(raw.amount) })),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  /** Redirige al checkout de Mercado Pago. Lanza si la URL no es un dominio permitido. */
  redirectToCheckout(initPoint: string): void {
    let url: URL;
    try {
      url = new URL(initPoint);
    } catch {
      throw new Error('La URL de pago recibida no es válida.');
    }
    if (url.protocol !== 'https:' || !isAllowedRedirectHost(url.hostname)) {
      throw new Error('La URL de pago recibida no pertenece a Mercado Pago.');
    }
    this.navigate(url.toString());
  }

  /** Guarda la venta en curso para recuperarla si Mercado Pago no devuelve external_reference. */
  rememberPendingSale(saleId: string): void {
    try {
      this.storage?.setItem(PENDING_SALE_KEY, saleId);
    } catch {
      // Sin storage: se depende solo de los parámetros de retorno.
    }
  }

  pendingSaleId(): string | null {
    try {
      return this.storage?.getItem(PENDING_SALE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  clearPendingSale(): void {
    try {
      this.storage?.removeItem(PENDING_SALE_KEY);
    } catch {
      // Nada que limpiar.
    }
  }

  /** Aislado para poder sustituirlo en tests (navegar de verdad recarga la página). */
  protected navigate(url: string): void {
    this.document.location.assign(url);
  }
}
