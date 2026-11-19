import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage } from '../../../core/utils/api-error';

/** Código del `409` cuando la venta ya no está en `Ordered` (cancelada o ya paga). */
export const SALE_NOT_PAYABLE = 'SALE_NOT_PAYABLE';

function bodyCode(error: HttpErrorResponse): unknown {
  const body: unknown = error.error;
  return typeof body === 'object' && body !== null
    ? (body as Record<string, unknown>)['code']
    : undefined;
}

/** `true` si el backend rechazó el pago porque la venta ya no se puede cobrar. */
export function isSaleNotPayable(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    error.status === 409 &&
    bodyCode(error) === SALE_NOT_PAYABLE
  );
}

/**
 * Mensaje para el usuario ante un error al registrar la venta o generar el pago. Los errores de
 * stock (409 con `INSUFFICIENT_STOCK`) no pasan por acá: tienen su propio diálogo.
 */
export function paymentErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return error instanceof Error
      ? error.message
      : 'No se pudo iniciar el pago. Intentá nuevamente.';
  }
  if (isSaleNotPayable(error)) {
    return 'La venta ya no se puede cobrar (está cancelada o ya fue paga). Armá una venta nueva.';
  }
  switch (error.status) {
    case 0:
      return 'No se pudo conectar con el servidor. Revisá tu conexión.';
    case 404:
      return 'La venta no existe.';
    case 409:
      return 'Ya se está generando el pago de esta venta. Esperá unos segundos y volvé a intentar.';
    case 502:
      return 'Mercado Pago rechazó la solicitud. Intentá nuevamente.';
    case 503:
      return 'El servicio no está disponible o está ocupado. No se cobró nada: reintentá en unos segundos.';
    case 504:
      return 'El pago tardó demasiado en generarse. Verificá el estado de la venta antes de reintentar.';
    default:
      return extractErrorMessage(error, 'No se pudo iniciar el pago. Intentá nuevamente.');
  }
}
