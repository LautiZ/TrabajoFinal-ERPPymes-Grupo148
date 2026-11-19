import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AnalyticsRangeDto,
  ERP_PATTERNS,
  SalesOverTimeDto,
  TopProductsDto,
} from '@app/contracts';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @MessagePattern(ERP_PATTERNS.ANALYTICS_SUMMARY)
  summary(@Payload() dto: AnalyticsRangeDto) {
    return this.analyticsService.summary(dto);
  }

  @MessagePattern(ERP_PATTERNS.ANALYTICS_SALES_OVER_TIME)
  salesOverTime(@Payload() dto: SalesOverTimeDto) {
    return this.analyticsService.salesOverTime(dto);
  }

  @MessagePattern(ERP_PATTERNS.ANALYTICS_TOP_PRODUCTS)
  topProducts(@Payload() dto: TopProductsDto) {
    return this.analyticsService.topProducts(dto);
  }

  @MessagePattern(ERP_PATTERNS.ANALYTICS_INVENTORY_VALUE)
  inventoryValue() {
    return this.analyticsService.inventoryValue();
  }
}
