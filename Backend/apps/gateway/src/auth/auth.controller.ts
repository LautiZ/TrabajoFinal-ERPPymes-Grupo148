import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
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
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { LoginResponseDto } from './dto/login-response.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH_SERVICE) private readonly authClient: ClientProxy) {}

  /** Log in with email and password */
  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: LoginResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Too many login attempts' })
  login(@Body() dto: LoginDto) {
    return sendRpc<LoginResponseDto, LoginDto>(
      this.authClient,
      AUTH_PATTERNS.LOGIN,
      dto,
    );
  }

  /** Revoke the current session */
  // The jti comes from the validated token, never from the request body
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
  async logout(@CurrentUser() user: AuthUser): Promise<void> {
    await sendRpc<void, LogoutDto>(this.authClient, AUTH_PATTERNS.LOGOUT, {
      jti: user.jti,
    });
  }
}
