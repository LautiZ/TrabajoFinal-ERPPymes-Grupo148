import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService, ServicesHealth } from './app.service';
import { Public } from './auth/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Docker healthcheck and monitoring must work without a token
  @Public()
  @Get('health')
  async health(): Promise<ServicesHealth> {
    const health = await this.appService.checkServices();
    if (Object.values(health).includes('down')) {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
