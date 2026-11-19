import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  CreateUserMessage,
  UserIdMessage,
} from '@app/contracts';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @MessagePattern(AUTH_PATTERNS.CREATE_USER)
  create(@Payload() message: CreateUserMessage) {
    return this.usersService.create(message);
  }

  @MessagePattern(AUTH_PATTERNS.GET_USER)
  getSummary(@Payload() { id }: UserIdMessage) {
    return this.usersService.getSummary(id);
  }
}
