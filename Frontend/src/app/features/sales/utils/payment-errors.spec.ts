import { HttpErrorResponse } from '@angular/common/http';
import { isSaleNotPayable, paymentErrorMessage } from './payment-errors';

const http = (status: number, body?: unknown): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: body });

describe('isSaleNotPayable', () => {
  it('reconoce el 409 con el código SALE_NOT_PAYABLE', () => {
    expect(isSaleNotPayable(http(409, { code: 'SALE_NOT_PAYABLE' }))).toBe(true);
  });

  it('no confunde otros 409 ni otros estados', () => {
    expect(isSaleNotPayable(http(409, { code: 'INSUFFICIENT_STOCK' }))).toBe(false);
    expect(isSaleNotPayable(http(409))).toBe(false);
    expect(isSaleNotPayable(http(400, { code: 'SALE_NOT_PAYABLE' }))).toBe(false);
    expect(isSaleNotPayable(new Error('x'))).toBe(false);
  });
});

describe('paymentErrorMessage', () => {
  it('explica que la venta ya no se puede cobrar', () => {
    expect(paymentErrorMessage(http(409, { code: 'SALE_NOT_PAYABLE' }))).toContain(
      'ya no se puede cobrar',
    );
  });

  it('un 409 sin código indica que el pago ya se está generando', () => {
    expect(paymentErrorMessage(http(409))).toContain('Ya se está generando el pago');
  });

  it('distingue venta inexistente, Mercado Pago, servicio ocupado y timeout', () => {
    expect(paymentErrorMessage(http(404))).toBe('La venta no existe.');
    expect(paymentErrorMessage(http(502))).toContain('Mercado Pago rechazó');
    expect(paymentErrorMessage(http(503))).toContain('No se cobró nada');
    expect(paymentErrorMessage(http(504))).toContain('tardó demasiado');
  });

  it('sin conexión (status 0) lo informa', () => {
    expect(paymentErrorMessage(http(0))).toContain('No se pudo conectar');
  });

  it('para otros errores usa el mensaje del backend o uno genérico', () => {
    expect(paymentErrorMessage(http(400, { message: 'saleId must be a UUID' }))).toBe(
      'saleId must be a UUID',
    );
    expect(paymentErrorMessage(http(400))).toBe('No se pudo iniciar el pago. Intentá nuevamente.');
  });

  it('un error que no es HTTP muestra su mensaje', () => {
    expect(paymentErrorMessage(new Error('La URL de pago recibida no es válida.'))).toBe(
      'La URL de pago recibida no es válida.',
    );
    expect(paymentErrorMessage('raro')).toBe('No se pudo iniciar el pago. Intentá nuevamente.');
  });
});
