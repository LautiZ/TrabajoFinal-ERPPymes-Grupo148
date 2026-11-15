import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import type { CreateUserMessage } from '@app/contracts';
import { hashPassword } from '../security/password';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

jest.mock('../security/password');

const hashMock = jest.mocked(hashPassword);

const newUser = {
  email: 'ana@pyme.test',
  password: 'long-enough-pass',
  name: 'Ana',
  role: 'Employee' as const,
};

const created = {
  id: 'user-2',
  email: 'ana@pyme.test',
  name: 'Ana',
  surname: null,
  role: 'Employee',
  active: true,
  createdAt: new Date('2026-11-15T00:00:00Z'),
};

const statusOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (err) {
    return ((err as RpcException).getError() as { status: number }).status;
  }
  throw new Error('expected the promise to reject');
};

describe('UsersService.create', () => {
  let service: UsersService;
  const users = { create: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    hashMock.mockResolvedValue('argon2-hash');

    const module = await Test.createTestingModule({
      providers: [UsersService, { provide: UsersRepository, useValue: users }],
    }).compile();
    service = module.get(UsersService);
  });

  const message = (
    actorRole: CreateUserMessage['actorRole'],
    role: CreateUserMessage['user']['role'],
  ): CreateUserMessage => ({ actorRole, user: { ...newUser, role } });

  it.each([
    ['Owner', 'Admin'],
    ['Owner', 'Employee'],
    ['Admin', 'Employee'],
  ] as const)('lets %s create a %s', async (actor, role) => {
    users.create.mockResolvedValue({ ...created, role });

    await expect(service.create(message(actor, role))).resolves.toMatchObject({
      role,
    });
  });

  it.each([
    ['Admin', 'Admin'],
    ['Employee', 'Employee'],
  ] as const)(
    'rejects with 403 a %s creating a %s, without hashing',
    async (actor, role) => {
      expect(await statusOf(service.create(message(actor, role)))).toBe(403);
      expect(hashMock).not.toHaveBeenCalled();
      expect(users.create).not.toHaveBeenCalled();
    },
  );

  it('stores the argon2 hash, never the plain password', async () => {
    users.create.mockResolvedValue(created);

    await service.create(message('Owner', 'Employee'));

    expect(hashMock).toHaveBeenCalledWith('long-enough-pass');
    const data = users.create.mock.calls[0][0] as Record<string, unknown>;
    expect(data.passwordHash).toBe('argon2-hash');
    expect(data).not.toHaveProperty('password');
  });

  it('rejects with 409 when the email is already taken', async () => {
    users.create.mockResolvedValue(null);

    expect(await statusOf(service.create(message('Owner', 'Employee')))).toBe(
      409,
    );
  });

  it('never returns the password hash', async () => {
    users.create.mockResolvedValue(created);

    const result = await service.create(message('Owner', 'Employee'));

    expect(result).not.toHaveProperty('passwordHash');
  });
});
