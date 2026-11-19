import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AnalyticsRangeDto,
  ERP_PATTERNS,
  ERP_SERVICE,
  SalesOverTimeDto,
  TopProductsDto,
} from '@app/contracts';
import { Roles } from '../auth/roles.decorator';
import { sendRpc } from '../common/send-rpc';
import {
  AnalyticsSummaryResponseDto,
  InventoryValuationResponseDto,
  SalesOverTimeResponseDto,
  TopProductsResponseDto,
} from './dto/analytics-response.dto';

// Financial reports are for the business owners only (TES-85/86/87).
// Every metric counts paid sales only: Paid or Dispatched.
@ApiTags('analytics')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@ApiForbiddenResponse({ description: 'Only Owner or Admin' })
@Roles('Owner', 'Admin')
@Controller('analytics')
export class AnalyticsController {
  constructor(@Inject(ERP_SERVICE) private readonly erpClient: ClientProxy) {}

  /** KPIs of the range (inclusive bounds) and of the period of equal length right before it */
  @Get('summary')
  @ApiOkResponse({ type: AnalyticsSummaryResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid dates, from after to, or a range longer than 5 years',
  })
  summary(@Query() query: AnalyticsRangeDto) {
    return sendRpc<AnalyticsSummaryResponseDto, AnalyticsRangeDto>(
      this.erpClient,
      ERP_PATTERNS.ANALYTICS_SUMMARY,
      query,
    );
  }

  /** Revenue and sales count per day, week (from Monday) or month, in Argentina time, with zeros for empty periods */
  @Get('sales-over-time')
  @ApiOkResponse({ type: SalesOverTimeResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid dates or groupBy, from after to, or more than 400 points (use a larger groupBy)',
  })
  salesOverTime(@Query() query: SalesOverTimeDto) {
    return sendRpc<SalesOverTimeResponseDto, SalesOverTimeDto>(
      this.erpClient,
      ERP_PATTERNS.ANALYTICS_SALES_OVER_TIME,
      query,
    );
  }

  /** Best-selling products of the range by units, then by revenue (price snapshot of each sale) */
  @Get('top-products')
  @ApiOkResponse({ type: TopProductsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid dates, from after to, or limit outside 1-50',
  })
  topProducts(@Query() query: TopProductsDto) {
    return sendRpc<TopProductsResponseDto, TopProductsDto>(
      this.erpClient,
      ERP_PATTERNS.ANALYTICS_TOP_PRODUCTS,
      query,
    );
  }

  /** Current value of the stock and count of products low on stock or out of it */
  @Get('inventory-value')
  @ApiOkResponse({ type: InventoryValuationResponseDto })
  inventoryValue() {
    return sendRpc<InventoryValuationResponseDto>(
      this.erpClient,
      ERP_PATTERNS.ANALYTICS_INVENTORY_VALUE,
      {},
    );
  }
}
