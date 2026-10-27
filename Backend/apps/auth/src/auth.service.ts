import { Injectable } from '@nestjs/common';
import { UsersRepository } from './users/users.repository';

@Injectable()
export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  countUsers(): Promise<number> {
    return this.usersRepository.count();
  }
}
