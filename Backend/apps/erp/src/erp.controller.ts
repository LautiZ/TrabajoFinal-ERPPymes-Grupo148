import { Controller, Get } from '@nestjs/common';
import { ErpService } from './erp.service';

@Controller()
export class ErpController {
  constructor(private readonly erpService: ErpService) {}

  @Get('products/count')
  countProducts(): Promise<number> {
    return this.erpService.countProducts();
  }
}
