import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage, isConflict, isNotFound } from './api-error';

const httpError = (status: number, body: unknown): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: body });

describe('extractErrorMessage', () => {
  it('usa el mensaje de texto del backend', () => {
    expect(extractErrorMessage(httpError(400, { message: 'Stock insuficiente' }), 'x')).toBe(
      'Stock insuficiente',
    );
  });

  it('une los mensajes de validación cuando vienen como lista', () => {
    expect(
      extractErrorMessage(
        httpError(400, { message: ['price debe ser positivo', 'sku requerido'] }),
        'x',
      ),
    ).toBe('price debe ser positivo sku requerido');
  });

  it('cae al mensaje por defecto si no hay uno utilizable', () => {
    expect(extractErrorMessage(httpError(500, null), 'Falló')).toBe('Falló');
    expect(extractErrorMessage(httpError(500, { message: '   ' }), 'Falló')).toBe('Falló');
    expect(extractErrorMessage(httpError(500, { message: [] }), 'Falló')).toBe('Falló');
    expect(extractErrorMessage(httpError(500, { message: [1, 2] }), 'Falló')).toBe('Falló');
    expect(extractErrorMessage(httpError(500, 'texto plano'), 'Falló')).toBe('Falló');
  });

  it('cae al mensaje por defecto si no es un error HTTP', () => {
    expect(extractErrorMessage(new Error('interno'), 'Falló')).toBe('Falló');
  });
});

describe('isConflict / isNotFound', () => {
  it('reconocen 409 y 404', () => {
    expect(isConflict(httpError(409, {}))).toBe(true);
    expect(isConflict(httpError(400, {}))).toBe(false);
    expect(isNotFound(httpError(404, {}))).toBe(true);
    expect(isNotFound(new Error('x'))).toBe(false);
  });
});
