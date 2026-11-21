import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ERP_PATTERNS, ListStockMovementsDto } from '@app/contracts';
import { StockMovementsService } from './stock-movements.service';

@Controller()
export class StockMovementsController {
  constructor(private readonly service: StockMovementsService) {}

  @MessagePattern(ERP_PATTERNS.LIST_STOCK_MOVEMENTS)
  list(@Payload() query: ListStockMovementsDto) {
    return this.service.list(query);
  }
}
