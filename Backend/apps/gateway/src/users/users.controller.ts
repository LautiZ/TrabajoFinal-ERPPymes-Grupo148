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
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreatedUserResponseDto } from './dto/created-user-response.dto';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(AUTH_SERVICE) private readonly authClient: ClientProxy) {}

  /** Create an Admin or Employee user (Owner creates Admin/Employee, Admin creates Employee) */
  // Gateway blocks Employee early; the Auth MS still enforces the full role matrix
  @Roles('Owner', 'Admin')
  @Post()
  @ApiCreatedResponse({ type: CreatedUserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  @ApiForbiddenResponse({ description: 'Role cannot create this user' })
  @ApiConflictResponse({ description: 'Email already registered' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateUserDto) {
    return sendRpc<CreatedUserResponseDto, CreateUserMessage>(
      this.authClient,
      AUTH_PATTERNS.CREATE_USER,
      {
        actorRole: user.role,
        user: dto,
      },
    );
  }
}
