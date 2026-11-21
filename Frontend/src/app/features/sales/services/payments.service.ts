import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { CreatePaymentRequest, Payment, PaymentState } from '../models/payment.model';
import { CART_STORAGE } from './cart.service';

export const PENDING_SALE_KEY = 'erp.sales.pending-sale.v1';

/** Solo se acepta un link de pago de estos dominios (y sus subdominios), aunque el backend devuelva otra URL. */
const ALLOWED_CHECKOUT_DOMAINS = [
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

function isAllowedCheckoutHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_CHECKOUT_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Forma del Payments MS: el monto (decimal de PostgreSQL) puede llegar como string. */
interface ApiPayment {
  id: string;
  saleId: string;
  amount: number | string;
  state: PaymentState;
  checkoutUrl?: string | null;
  createdAt?: string;
}

function toPayment(raw: ApiPayment): Payment {
  return {
    id: raw.id,
    saleId: raw.saleId,
    amount: Number(raw.amount),
    state: raw.state,
    checkoutUrl: raw.checkoutUrl ?? null,
    createdAt: raw.createdAt ?? '',
  };
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
  private readonly storage = inject(CART_STORAGE);

  /**
   * Genera el pago de una venta (`POST /payments`). Es idempotente del lado del servidor: si ya
   * hay un pago pendiente para la venta, devuelve ese mismo checkout.
   */
  createPayment(saleId: string): Observable<Payment> {
    const request: CreatePaymentRequest = { saleId };
    return this.api.post<ApiPayment>('payments', request).pipe(map(toPayment));
  }

  /** Último intento de pago de una venta; `null` si todavía no existe (404). */
  getPaymentBySale(saleId: string): Observable<Payment | null> {
    return this.api.get<ApiPayment>(`payments/sale/${encodeURIComponent(saleId)}`).pipe(
      map(toPayment),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(null)
          : throwError(() => error),
      ),
    );
  }

  /**
   * Valida el link de pago devuelto por el backend antes de mostrarlo al cliente: tiene que ser
   * https y de un dominio de Mercado Pago. Lanza si falta o no es válido.
   */
  validCheckoutUrl(checkoutUrl: string | null): string {
    if (!checkoutUrl) {
      throw new Error('El servidor no devolvió la URL de pago.');
    }
    let url: URL;
    try {
      url = new URL(checkoutUrl);
    } catch {
      throw new Error('La URL de pago recibida no es válida.');
    }
    if (url.protocol !== 'https:' || !isAllowedCheckoutHost(url.hostname)) {
      throw new Error('La URL de pago recibida no pertenece a Mercado Pago.');
    }
    return url.toString();
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
}
