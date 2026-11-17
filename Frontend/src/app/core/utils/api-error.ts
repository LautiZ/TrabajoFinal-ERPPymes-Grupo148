import { HttpErrorResponse } from '@angular/common/http';

/**
 * Mensaje de error del backend para mostrar al usuario. NestJS devuelve `message` como texto
 * o como lista (validaciones); si no hay un mensaje utilizable se usa `fallback`.
 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  const body: unknown = error.error;
  const message =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)['message']
      : undefined;

  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  if (Array.isArray(message) && message.length > 0 && message.every((m) => typeof m === 'string')) {
    return message.join(' ');
  }
  return fallback;
}

/** `409 Conflict`: p. ej. un SKU que ya existe. */
export function isConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 409;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
