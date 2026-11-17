import { ValidationError, ValidationPipe } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';

// Nested DTOs (@ValidateNested) report their errors in children, not constraints
const collectMessages = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => [
    ...Object.values(e.constraints ?? {}),
    ...collectMessages(e.children ?? []),
  ]);

// ValidationPipe throws BadRequestException (HTTP) by default, which a TCP
// microservice turns into a generic 500. Throwing RpcException keeps the 400.
export function createRpcValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new RpcException({ status: 400, message: collectMessages(errors) }),
  });
}
