import { ValidationPipe } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

// ValidationPipe throws BadRequestException (HTTP) by default, which a TCP
// microservice turns into a generic 500. Throwing RpcException keeps the 400.
export function createRpcValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new RpcException({
        status: 400,
        message: errors.flatMap((e) => Object.values(e.constraints ?? {})),
      }),
  });
}
