import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { TCP_TIMEOUT_MS } from '../config/tcp';

// Errors are not caught here: RpcToHttpExceptionFilter maps them to HTTP.
// timeoutMs is only raised for routes that wait on an external provider.
export const sendRpc = <TResult, TPayload = unknown>(
  client: ClientProxy,
  pattern: string,
  payload: TPayload,
  timeoutMs: number = TCP_TIMEOUT_MS,
): Promise<TResult> =>
  firstValueFrom(
    client.send<TResult, TPayload>(pattern, payload).pipe(timeout(timeoutMs)),
    // void handlers complete without emitting; resolve instead of throwing EmptyError
    { defaultValue: undefined as TResult },
  );
