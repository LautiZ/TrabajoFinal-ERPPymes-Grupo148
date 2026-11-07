import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { AppService, ServicesHealth } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  async health(): Promise<ServicesHealth> {
    const health = await this.appService.checkServices();
    if (Object.values(health).includes('down')) {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }
}
