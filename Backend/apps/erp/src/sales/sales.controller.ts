import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateSaleMessage,
  ERP_PATTERNS,
  ListSalesDto,
  SaleIdMessage,
} from '@app/contracts';
import { SalesService } from './sales.service';

@Controller()
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @MessagePattern(ERP_PATTERNS.CREATE_SALE)
  create(@Payload() message: CreateSaleMessage) {
    return this.salesService.create(message);
  }

  @MessagePattern(ERP_PATTERNS.LIST_SALES)
  list(@Payload() query: ListSalesDto) {
    return this.salesService.list(query);
  }

  @MessagePattern(ERP_PATTERNS.GET_SALE)
  get(@Payload() { id }: SaleIdMessage) {
    return this.salesService.get(id);
  }

  @MessagePattern(ERP_PATTERNS.MARK_SALE_PAID)
  markPaid(@Payload() { id }: SaleIdMessage) {
    return this.salesService.markPaid(id);
  }
}
