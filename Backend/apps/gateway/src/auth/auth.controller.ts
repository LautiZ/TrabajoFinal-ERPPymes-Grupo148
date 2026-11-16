import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  AUTH_SERVICE,
  LoginDto,
  LogoutDto,
} from '@app/contracts';
import { sendRpc } from '../common/send-rpc';
import { CurrentUser } from './current-user.decorator';
import { Public } from './public.decorator';
import type { AuthUser } from '@app/contracts';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly authClient: ClientProxy) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return sendRpc(this.authClient, AUTH_PATTERNS.LOGIN, dto);
  }

  // The jti comes from the validated token, never from the request body
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await sendRpc<void, LogoutDto>(this.authClient, AUTH_PATTERNS.LOGOUT, {
      jti: user.jti,
    });
  }
}
