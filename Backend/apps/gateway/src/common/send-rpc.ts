import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { TCP_TIMEOUT_MS } from '../config/tcp';

// Errors are not caught here: RpcToHttpExceptionFilter maps them to HTTP
export const sendRpc = <TResult, TPayload = unknown>(
  client: ClientProxy,
  pattern: string,
  payload: TPayload,
): Promise<TResult> =>
  firstValueFrom(
    client
      .send<TResult, TPayload>(pattern, payload)
      .pipe(timeout(TCP_TIMEOUT_MS)),
    // void handlers complete without emitting; resolve instead of throwing EmptyError
    { defaultValue: undefined as TResult },
  );
