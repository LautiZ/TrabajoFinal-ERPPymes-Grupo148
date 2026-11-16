import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser, Role } from '@app/contracts';
import { AuthenticatedRequest } from './auth.guard';
import { RolesGuard } from './roles.guard';

const contextWith = (user?: AuthUser) => {
  const request = { headers: {}, user } as AuthenticatedRequest;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
};

const userWith = (role: Role): AuthUser => ({
  userId: 'u-1',
  role,
  jti: 'j-1',
});

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() };
  const guard = new RolesGuard(reflector as unknown as Reflector);

  beforeEach(() => jest.resetAllMocks());

  it('should allow any authenticated user when the route has no @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith(userWith('Employee')))).toBe(true);
  });

  it('should allow a user whose role is required', () => {
    reflector.getAllAndOverride.mockReturnValue(['Owner', 'Admin']);
    expect(guard.canActivate(contextWith(userWith('Admin')))).toBe(true);
  });

  it('should reject with 403 a user whose role is not required', () => {
    reflector.getAllAndOverride.mockReturnValue(['Owner', 'Admin']);
    expect(() => guard.canActivate(contextWith(userWith('Employee')))).toThrow(
      ForbiddenException,
    );
  });

  it('should fail closed with 403 when roles are required but there is no user', () => {
    reflector.getAllAndOverride.mockReturnValue(['Owner']);
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
