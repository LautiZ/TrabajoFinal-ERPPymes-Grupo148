import { JwtService } from '@nestjs/jwt';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { verifyPasswordOrDummy } from './security/password';
import { SessionsRepository } from './sessions/sessions.repository';
import { UsersRepository } from './users/users.repository';

jest.mock('./config/envs', () => ({ envs: { JWT_EXPIRES_IN: 1800 } }));
jest.mock('./security/password');

const verifyMock = jest.mocked(verifyPasswordOrDummy);

const user = {
  id: 'user-1',
  email: 'owner@pyme.test',
  passwordHash: 'hash',
  name: 'Ana',
  surname: null,
  active: true,
  role: 'Owner',
};

describe('AuthService.login', () => {
  let service: AuthService;
  const users = { findByEmail: jest.fn() };
  const sessions = { create: jest.fn() };
  const jwt = { signAsync: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Fixed clock: 1_700_000_000.5 s -> exp must be 1_700_000_000 + 1800
    jest.spyOn(Date, 'now').mockReturnValue(1_700_000_000_500);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersRepository, useValue: users },
        { provide: SessionsRepository, useValue: sessions },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  const dto = { email: 'owner@pyme.test', password: 'secret' };

  it('rejects an unknown email after running the dummy verify', async () => {
    users.findByEmail.mockResolvedValue(null);
    verifyMock.mockResolvedValue(false);

    await expect(service.login(dto)).rejects.toBeInstanceOf(RpcException);
    expect(verifyMock).toHaveBeenCalledWith(null, 'secret');
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects a wrong password', async () => {
    users.findByEmail.mockResolvedValue(user);
    verifyMock.mockResolvedValue(false);

    await expect(service.login(dto)).rejects.toBeInstanceOf(RpcException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('rejects an inactive user even with the right password', async () => {
    users.findByEmail.mockResolvedValue({ ...user, active: false });
    verifyMock.mockResolvedValue(true);

    await expect(service.login(dto)).rejects.toBeInstanceOf(RpcException);
    expect(sessions.create).not.toHaveBeenCalled();
  });

  it('creates a session and signs a token whose exp matches it', async () => {
    users.findByEmail.mockResolvedValue(user);
    verifyMock.mockResolvedValue(true);
    sessions.create.mockResolvedValue({ id: 'session-1' });
    jwt.signAsync.mockResolvedValue('signed.jwt');

    const result = await service.login(dto);

    const exp = 1_700_000_000 + 1800;
    expect(sessions.create).toHaveBeenCalledWith(
      'user-1',
      new Date(exp * 1000),
    );
    expect(jwt.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      role: 'Owner',
      jti: 'session-1',
      exp,
    });
    expect(result).toEqual({
      accessToken: 'signed.jwt',
      user: {
        id: 'user-1',
        email: 'owner@pyme.test',
        name: 'Ana',
        surname: null,
        role: 'Owner',
      },
    });
  });
});
