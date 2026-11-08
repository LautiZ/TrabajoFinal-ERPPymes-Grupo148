import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { LoginDto } from '@app/contracts';
import { envs } from './config/envs';
import { verifyPasswordOrDummy } from './security/password';
import { SessionsRepository } from './sessions/sessions.repository';
import { UsersRepository } from './users/users.repository';

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
      throw new RpcException({ status: 401, message: 'Invalid credentials' });
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
}
