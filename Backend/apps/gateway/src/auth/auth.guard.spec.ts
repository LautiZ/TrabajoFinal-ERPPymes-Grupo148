import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { NEVER, of, throwError } from 'rxjs';
import { AUTH_PATTERNS, AuthUser } from '@app/contracts';
import { AuthGuard, AuthenticatedRequest } from './auth.guard';

const user: AuthUser = { userId: 'u-1', role: 'ADMIN', jti: 'j-1' };

const contextWith = (headers: Record<string, string>) => {
  const request = { headers } as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
};

describe('AuthGuard', () => {
  const authClient = { send: jest.fn() };
  const guard = new AuthGuard(authClient as unknown as ClientProxy);

  beforeEach(() => jest.resetAllMocks());

  it('should reject a request without Authorization header and skip the TCP call', async () => {
    const { context } = contextWith({});
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('should reject a non-Bearer scheme and skip the TCP call', async () => {
    const { context } = contextWith({ authorization: 'Basic abc' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(authClient.send).not.toHaveBeenCalled();
  });

  it('should attach the user to the request when Auth validates the token', async () => {
    authClient.send.mockReturnValue(of(user));
    const { request, context } = contextWith({ authorization: 'Bearer tkn' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(user);
    expect(authClient.send).toHaveBeenCalledWith(AUTH_PATTERNS.VALIDATE_TOKEN, {
      token: 'tkn',
    });
  });

  it.each([401, 400])(
    'should map an Auth %i (e.g. revoked session) to 401',
    async (status) => {
      authClient.send.mockReturnValue(
        throwError(() => ({ status, message: 'x' })),
      );
      const { context } = contextWith({ authorization: 'Bearer tkn' });
      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    },
  );

  it('should return 503 when Auth is unreachable', async () => {
    authClient.send.mockReturnValue(
      throwError(() => new Error('ECONNREFUSED')),
    );
    const { context } = contextWith({ authorization: 'Bearer tkn' });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('should return 503 when Auth does not answer in time', async () => {
    jest.useFakeTimers();
    authClient.send.mockReturnValue(NEVER);
    const { context } = contextWith({ authorization: 'Bearer tkn' });

    const result = guard.canActivate(context);
    const assertion = expect(result).rejects.toThrow(
      ServiceUnavailableException,
    );
    await jest.advanceTimersByTimeAsync(5000);
    await assertion;
    jest.useRealTimers();
  });
});
