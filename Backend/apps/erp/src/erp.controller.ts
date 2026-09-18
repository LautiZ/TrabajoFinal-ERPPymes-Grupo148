import { Controller, Get } from '@nestjs/common';
import { ErpService } from './erp.service';

@Controller()
export class ErpController {
  constructor(private readonly erpService: ErpService) {}

  @Get()
  getHello(): string {
    return this.erpService.getHello();
  }
}
