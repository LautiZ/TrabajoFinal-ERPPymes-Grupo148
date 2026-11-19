import { ClientProxy, RpcException } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import { ERP_PATTERNS } from '@app/contracts';
import { ERP_TIMEOUT_MS, SalesClient } from './sales.client';

const errorOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    expect(err).toBeInstanceOf(RpcException);
    return (err as RpcException).getError() as Record<string, unknown>;
  }
  throw new Error('expected the promise to reject');
};

describe('SalesClient', () => {
  const send = jest.fn();
  const client = new SalesClient({ send } as unknown as ClientProxy);

  beforeEach(() => send.mockReset());
  afterEach(() => jest.useRealTimers());

  it('asks the ERP for the sale', async () => {
    send.mockReturnValue(of({ id: 'sale-1' }));

    await expect(client.getSale('sale-1')).resolves.toEqual({ id: 'sale-1' });
    expect(send).toHaveBeenCalledWith(ERP_PATTERNS.GET_SALE, { id: 'sale-1' });
  });

  // A plain object rethrown from a handler reaches the gateway as a 500
  it('forwards ERP errors as RPC errors with the same status', async () => {
    send.mockReturnValue(
      throwError(() => ({ status: 404, message: 'Sale not found' })),
    );

    expect(await errorOf(client.getSale('sale-1'))).toEqual({
      status: 404,
      message: 'Sale not found',
    });
  });

  it('answers 503 when the ERP does not respond in time', async () => {
    jest.useFakeTimers();
    send.mockReturnValue(NEVER);

    const pending = errorOf(client.getSale('sale-1'));
    jest.advanceTimersByTime(ERP_TIMEOUT_MS);

    expect(await pending).toEqual({
      status: 503,
      message: 'ERP service unavailable',
    });
  });

  it('answers 503 when the ERP is unreachable', async () => {
    send.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED 127.0.0.1:3002')),
    );

    expect((await errorOf(client.getSale('sale-1'))).status).toBe(503);
  });

  it('asks the ERP to mark the sale as paid', async () => {
    send.mockReturnValue(of({ id: 'sale-1', currentState: 'Paid' }));

    await expect(client.markPaid('sale-1')).resolves.toMatchObject({
      currentState: 'Paid',
    });
    expect(send).toHaveBeenCalledWith(ERP_PATTERNS.MARK_SALE_PAID, {
      id: 'sale-1',
    });
  });

  it('keeps the ERP status and code when marking as paid fails', async () => {
    send.mockReturnValue(
      throwError(() => ({ status: 409, code: 'SALE_CANCELLED', message: 'x' })),
    );

    expect(await errorOf(client.markPaid('sale-1'))).toMatchObject({
      status: 409,
      code: 'SALE_CANCELLED',
    });
  });
});
