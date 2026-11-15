import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { CreatableRole, CreateUserMessage, Role } from '@app/contracts';
import { hashPassword } from '../security/password';
import { UsersRepository } from './users.repository';

// Who may create whom. Admins cannot create peers (no privilege escalation)
const CAN_CREATE: Record<Role, readonly CreatableRole[]> = {
  Owner: ['Admin', 'Employee'],
  Admin: ['Employee'],
  Employee: [],
};

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create({ actorRole, user }: CreateUserMessage) {
    // Cheap check first: argon2 is slow on purpose
    if (!CAN_CREATE[actorRole].includes(user.role)) {
      throw new RpcException({ status: 403, message: 'Forbidden' });
    }

    const { password, ...data } = user;
    const created = await this.usersRepository.create({
      ...data,
      passwordHash: await hashPassword(password),
    });

    if (!created) {
      throw new RpcException({
        status: 409,
        message: 'Email already registered',
      });
    }
    return created;
  }
}
