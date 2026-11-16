import { ClientProxy } from '@nestjs/microservices';
import { EMPTY, NEVER, of, throwError, TimeoutError } from 'rxjs';
import { TCP_TIMEOUT_MS } from '../config/tcp';
import { sendRpc } from './send-rpc';

describe('sendRpc', () => {
  const send = jest.fn();
  const client = { send } as unknown as ClientProxy;

  beforeEach(() => send.mockReset());
  afterEach(() => jest.useRealTimers());

  it('sends the pattern and payload and resolves with the answer', async () => {
    send.mockReturnValue(of({ ok: true }));

    await expect(sendRpc(client, 'some.pattern', { a: 1 })).resolves.toEqual({
      ok: true,
    });
    expect(send).toHaveBeenCalledWith('some.pattern', { a: 1 });
  });

  // Regression: void handlers (logout) complete without emitting -> was a 500
  it('resolves undefined when the handler completes without a value', async () => {
    send.mockReturnValue(EMPTY);

    await expect(sendRpc(client, 'some.pattern', {})).resolves.toBeUndefined();
  });

  it('rejects with the RPC error payload untouched', async () => {
    const rpcError = { status: 403, message: 'Forbidden' };
    send.mockReturnValue(throwError(() => rpcError));

    await expect(sendRpc(client, 'some.pattern', {})).rejects.toEqual(rpcError);
  });

  it('rejects with TimeoutError when the microservice never answers', async () => {
    jest.useFakeTimers();
    send.mockReturnValue(NEVER);

    const pending = sendRpc(client, 'some.pattern', {});
    jest.advanceTimersByTime(TCP_TIMEOUT_MS);

    await expect(pending).rejects.toBeInstanceOf(TimeoutError);
  });
});
