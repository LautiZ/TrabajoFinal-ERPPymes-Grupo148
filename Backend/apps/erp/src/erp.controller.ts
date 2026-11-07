import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ERP_PATTERNS } from '@app/contracts';
import { ErpService } from './erp.service';

@Controller()
export class ErpController {
  constructor(private readonly erpService: ErpService) {}

  @MessagePattern(ERP_PATTERNS.COUNT_PRODUCTS)
  countProducts(): Promise<number> {
    return this.erpService.countProducts();
  }
}
