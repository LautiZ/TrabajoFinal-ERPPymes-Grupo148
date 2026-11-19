import { RpcException } from '@nestjs/microservices';
import {
  MPAuthenticationError,
  MPBadRequestError,
  MPConnectionError,
  MPNotFoundError,
  MPRateLimitError,
  MPServerError,
} from 'mercadopago';
import { translateMercadoPagoError } from './mercadopago-errors';

const rpcBody = (error: unknown) => {
  expect(error).toBeInstanceOf(RpcException);
  return (error as RpcException).getError() as Record<string, unknown>;
};

const apiBody = (status: number) => ({
  status,
  message: 'provider detail that must not leak',
});

describe('translateMercadoPagoError', () => {
  it('maps a network failure to 503', () => {
    const body = rpcBody(
      translateMercadoPagoError(new MPConnectionError(new Error('ETIMEDOUT'))),
    );
    expect(body).toEqual({
      status: 503,
      message: 'Payment provider unavailable',
    });
  });

  it('maps a rate limit to 503', () => {
    const body = rpcBody(
      translateMercadoPagoError(new MPRateLimitError(apiBody(429), 10)),
    );
    expect(body.status).toBe(503);
  });

  it('maps a not found resource to 404', () => {
    const body = rpcBody(
      translateMercadoPagoError(new MPNotFoundError(apiBody(404))),
    );
    expect(body).toEqual({
      status: 404,
      message: 'Resource not found in payment provider',
    });
  });

  it.each([
    ['server error', new MPServerError(apiBody(500))],
    ['bad request', new MPBadRequestError(apiBody(400))],
    ['invalid credentials', new MPAuthenticationError(apiBody(401))],
  ])('maps a %s to a generic 502', (_, error) => {
    const body = rpcBody(translateMercadoPagoError(error));
    expect(body).toEqual({ status: 502, message: 'Payment provider error' });
  });

  it('never forwards the provider message to the client', () => {
    const body = rpcBody(
      translateMercadoPagoError(new MPBadRequestError(apiBody(400))),
    );
    expect(JSON.stringify(body)).not.toContain('must not leak');
  });

  it('returns errors that do not come from Mercado Pago unchanged', () => {
    const bug = new TypeError('cannot read x of undefined');
    expect(translateMercadoPagoError(bug)).toBe(bug);
  });
});
