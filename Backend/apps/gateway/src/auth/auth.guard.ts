import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import type { Request } from 'express';
import { AUTH_PATTERNS, AUTH_SERVICE, AuthUser } from '@app/contracts';
import { TCP_TIMEOUT_MS } from '../config/tcp';
import { IS_PUBLIC_KEY } from './public.decorator';

export type AuthenticatedRequest = Request & { user?: AuthUser };

// Auth MS rejections arrive as the plain RpcException payload: { status, message }.
// 400 (malformed token) is reported as 401 so the client learns nothing extra.
const isRejectedByAuth = (err: unknown): boolean =>
  typeof err === 'object' &&
  err !== null &&
  'status' in err &&
  (err.status === 400 || err.status === 401);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Handler metadata wins over class metadata
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearer(request);
    if (!token) throw new UnauthorizedException();

    try {
      request.user = await firstValueFrom(
        this.authClient
          .send<AuthUser>(AUTH_PATTERNS.VALIDATE_TOKEN, { token })
          .pipe(timeout(TCP_TIMEOUT_MS)),
      );
      return true;
    } catch (err) {
      if (isRejectedByAuth(err)) throw new UnauthorizedException();
      // Fail closed: if Auth cannot answer, nobody gets through
      throw new ServiceUnavailableException('Auth service unavailable');
    }
  }

  private extractBearer(request: Request): string | undefined {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
