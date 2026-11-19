import {
  ArgumentsHost,
  Catch,
  GatewayTimeoutException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { TimeoutError } from 'rxjs';

type RpcError = { status: number; message: string | string[] };

// Microservice rejections arrive as the plain RpcException payload: { status, message }
const isRpcError = (err: unknown): err is RpcError =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  'message' in err &&
  typeof err.status === 'number' &&
  err.status >= 400 &&
  err.status <= 599;

// The TCP client rejects with the socket error when the microservice is down
const isConnectionRefused = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'code' in err &&
  err.code === 'ECONNREFUSED';

@Catch()
export class RpcToHttpExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    super.catch(this.toHttp(exception), host);
  }

  private toHttp(exception: unknown): unknown {
    if (exception instanceof HttpException) return exception;
    if (exception instanceof TimeoutError) {
      return new GatewayTimeoutException('Service timed out');
    }
    if (isConnectionRefused(exception)) {
      return new ServiceUnavailableException('Service unavailable');
    }
    if (isRpcError(exception)) {
      // Extra fields (e.g. code and items of a stock conflict) reach the client;
      // statusCode and message go last so the payload cannot override them
      const { status, message, ...extra } = exception;
      return new HttpException(
        { ...extra, statusCode: status, message },
        status,
      );
    }
    // Unknown errors fall through to Nest's default 500 (and get logged)
    return exception;
  }
}
