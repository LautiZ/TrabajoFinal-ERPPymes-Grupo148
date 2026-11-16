import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUTH_PATTERNS,
  AuthUser,
  LoginDto,
  LogoutDto,
  ValidateTokenDto,
} from '@app/contracts';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern(AUTH_PATTERNS.COUNT_USERS)
  countUsers(): Promise<number> {
    return this.authService.countUsers();
  }

  @MessagePattern(AUTH_PATTERNS.LOGIN)
  login(@Payload() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @MessagePattern(AUTH_PATTERNS.VALIDATE_TOKEN)
  validateToken(@Payload() dto: ValidateTokenDto): Promise<AuthUser> {
    return this.authService.validateToken(dto);
  }

  @MessagePattern(AUTH_PATTERNS.LOGOUT)
  logout(@Payload() dto: LogoutDto): Promise<void> {
    return this.authService.logout(dto);
  }
}
