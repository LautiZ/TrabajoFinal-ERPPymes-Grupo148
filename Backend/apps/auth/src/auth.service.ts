import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import {
  AuthUser,
  LoginDto,
  LogoutDto,
  ValidateTokenDto,
} from '@app/contracts';
import { envs } from './config/envs';
import { verifyPasswordOrDummy } from './security/password';
import { SessionsRepository } from './sessions/sessions.repository';
import { UsersRepository } from './users/users.repository';

const unauthorized = (message = 'Unauthorized') =>
  new RpcException({ status: 401, message });

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly sessionsRepository: SessionsRepository,
    private readonly jwtService: JwtService,
  ) {}

  countUsers(): Promise<number> {
    return this.usersRepository.count();
  }

  async login({ email, password }: LoginDto) {
    const user = await this.usersRepository.findByEmail(email);
    // Always runs argon2, even for an unknown email (see verifyPasswordOrDummy)
    const valid = await verifyPasswordOrDummy(
      user?.passwordHash ?? null,
      password,
    );

    // One generic error for unknown email, wrong password and inactive user,
    // so the response never reveals which accounts exist
    if (!user || !valid || !user.active) {
      throw unauthorized('Invalid credentials');
    }

    // Computed once: the session expiry and the token exp are the same instant
    const exp = Math.floor(Date.now() / 1000) + envs.JWT_EXPIRES_IN;
    const session = await this.sessionsRepository.create(
      user.id,
      new Date(exp * 1000),
    );

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      jti: session.id,
      exp,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.role,
      },
    };
  }

  async validateToken({ token }: ValidateTokenDto): Promise<AuthUser> {
    let jti: unknown;
    try {
      // Signature + exp; pinning the algorithm blocks alg-swap attacks
      ({ jti } = await this.jwtService.verifyAsync<{ jti?: unknown }>(token, {
        algorithms: ['HS256'],
      }));
    } catch {
      throw unauthorized();
    }

    // Prisma treats undefined in a where as "no filter": never query without a jti
    if (typeof jti !== 'string') {
      throw unauthorized();
    }

    const session = await this.sessionsRepository.findActive(jti);
    if (!session) {
      throw unauthorized();
    }

    // Role from the DB, so role changes and deactivations apply immediately
    return {
      userId: session.user.id,
      role: session.user.role,
      jti: session.id,
    };
  }

  async logout({ jti }: LogoutDto): Promise<void> {
    await this.sessionsRepository.revoke(jti);
  }

  async logoutAll(userId: string): Promise<number> {
    return this.sessionsRepository.revokeAllForUser(userId);
  }
}
