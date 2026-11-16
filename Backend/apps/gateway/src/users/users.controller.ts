import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  AUTH_SERVICE,
  CreateUserDto,
  CreateUserMessage,
} from '@app/contracts';
import { sendRpc } from '../common/send-rpc';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { AuthUser } from '@app/contracts';

@Controller('users')
export class UsersController {
  constructor(@Inject(AUTH_SERVICE) private readonly authClient: ClientProxy) {}

  // Gateway blocks Employee early; the Auth MS still enforces the full role matrix
  @Roles('Owner', 'Admin')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return sendRpc<unknown, CreateUserMessage>(
      this.authClient,
      AUTH_PATTERNS.CREATE_USER,
      {
        actorRole: user.role,
        user: dto,
      },
    );
  }
}
