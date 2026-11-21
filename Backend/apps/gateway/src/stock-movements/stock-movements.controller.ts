import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ERP_PATTERNS,
  ERP_SERVICE,
  ListStockMovementsDto,
} from '@app/contracts';
import { sendRpc } from '../common/send-rpc';
import { StockMovementPageResponseDto } from './dto/stock-movement-response.dto';

// No @Roles: every role operates the ERP without restrictions (RN-16.3)
@ApiTags('stock-movements')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('stock-movements')
export class StockMovementsController {
  constructor(@Inject(ERP_SERVICE) private readonly erpClient: ClientProxy) {}

  /**
   * Stock movements of every product, newest first: sale outcomes, their
   * reversal on cancel, initial stock and manual adjustments (with reason)
   */
  @Get()
  @ApiOkResponse({ type: StockMovementPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query params' })
  list(@Query() query: ListStockMovementsDto) {
    return sendRpc<StockMovementPageResponseDto, ListStockMovementsDto>(
      this.erpClient,
      ERP_PATTERNS.LIST_STOCK_MOVEMENTS,
      query,
    );
  }
}
