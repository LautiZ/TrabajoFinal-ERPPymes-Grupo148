import { Logger } from '@nestjs/common';
import {
  MPConnectionError,
  MPNotFoundError,
  MPRateLimitError,
  MercadoPagoError,
} from 'mercadopago';
import { rpcError } from '../common/rpc-error';

const logger = new Logger('MercadoPago');

// Turns SDK errors into RPC errors with generic messages: the provider detail
// is only logged, never sent to the client. The SDK builds its errors from the
// response body, so the access token is never part of them.
// Errors that do not come from the SDK are returned unchanged (they are bugs).
export const translateMercadoPagoError = (error: unknown): unknown => {
  if (!(error instanceof MercadoPagoError)) return error;

  logger.warn(
    `Mercado Pago request failed: ${error.constructor.name} (status ${error.status}): ${error.error}`,
  );

  if (error instanceof MPConnectionError || error instanceof MPRateLimitError) {
    return rpcError(503, 'Payment provider unavailable');
  }
  if (error instanceof MPNotFoundError) {
    return rpcError(404, 'Resource not found in payment provider');
  }
  // 400/422 mean we built a bad request and 401/403 a bad token: none of them
  // can be fixed by the client, so they all surface as an upstream failure
  return rpcError(502, 'Payment provider error');
};
