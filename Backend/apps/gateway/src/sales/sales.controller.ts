import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CreateSaleDto,
  CreateSaleMessage,
  ERP_PATTERNS,
  ERP_SERVICE,
  ListSalesDto,
  SaleIdMessage,
} from '@app/contracts';
import type { AuthUser } from '@app/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { sendRpc } from '../common/send-rpc';
import {
  InsufficientStockResponseDto,
  SalePageResponseDto,
  SaleResponseDto,
} from './dto/sale-response.dto';

// No @Roles: every role registers sales (RN-16.3)
@ApiTags('sales')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('sales')
export class SalesController {
  constructor(@Inject(ERP_SERVICE) private readonly erpClient: ClientProxy) {}

  /** Register a sale in Ordered and reserve its stock; prices and total come from the backend (RN-06) */
  @Post()
  @ApiCreatedResponse({ type: SaleResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid body, repeated product, decimal quantity on a Unit product or total too large',
  })
  @ApiConflictResponse({
    type: InsufficientStockResponseDto,
    description:
      'Some items are short of stock, deleted or paused; nothing was written',
  })
  @ApiServiceUnavailableResponse({
    description: 'Too many concurrent sales; nothing was written, retry',
  })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSaleDto) {
    return sendRpc<SaleResponseDto, CreateSaleMessage>(
      this.erpClient,
      ERP_PATTERNS.CREATE_SALE,
      { userId: user.userId, sale: dto },
    );
  }

  /** List sales, newest first, filtered by state and creation date */
  @Get()
  @ApiOkResponse({ type: SalePageResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid query params or from after to',
  })
  list(@Query() query: ListSalesDto) {
    return sendRpc<SalePageResponseDto, ListSalesDto>(
      this.erpClient,
      ERP_PATTERNS.LIST_SALES,
      query,
    );
  }

  /** Get a sale with its items and state history */
  @Get(':id')
  @ApiOkResponse({ type: SaleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Sale not found' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return sendRpc<SaleResponseDto, SaleIdMessage>(
      this.erpClient,
      ERP_PATTERNS.GET_SALE,
      { id },
    );
  }
}
