import { Payment } from '../models/payment.model';
import { Sale } from '../models/sale.model';

export type ResultStatus = 'approved' | 'rejected' | 'pending';

/**
 * Estado real de la operación según el backend (confirmado por el webhook de Mercado Pago,
 * RN-15). Los query params de retorno nunca deciden por sí solos: sin datos del backend
 * la operación se considera pendiente.
 */
export function resolvePaymentStatus(sale: Sale | null, payment: Payment | null): ResultStatus {
  if (
    payment?.paymentState === 'Paid' ||
    sale?.currentState === 'Paid' ||
    sale?.currentState === 'Dispatched'
  ) {
    return 'approved';
  }
  if (payment?.paymentState === 'Rejected' || sale?.currentState === 'Cancelled') {
    return 'rejected';
  }
  return 'pending';
}

/** Lo que Mercado Pago dice en la URL de retorno; solo sirve de pista mientras se verifica. */
export function statusFromReturnParam(value: string | null): ResultStatus | null {
  switch (value) {
    case 'success':
      return 'approved';
    case 'failure':
      return 'rejected';
    case 'pending':
      return 'pending';
    default:
      return null;
  }
}
