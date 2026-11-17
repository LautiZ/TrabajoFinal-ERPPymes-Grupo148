import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { AUTH_PATTERNS, CreateUserMessage } from '@app/contracts';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(AUTH_PATTERNS.CREATE_USER)
  create(@Payload() message: CreateUserMessage) {
    return this.usersService.create(message);
  }
}
