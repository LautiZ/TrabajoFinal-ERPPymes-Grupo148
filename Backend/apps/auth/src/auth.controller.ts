import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('users/count')
  countUsers(): Promise<number> {
    return this.authService.countUsers();
  }
}
