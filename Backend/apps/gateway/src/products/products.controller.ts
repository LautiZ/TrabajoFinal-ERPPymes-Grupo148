import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AdjustStockDto,
  AdjustStockMessage,
  CreateProductDto,
  CreateProductMessage,
  ERP_PATTERNS,
  ERP_SERVICE,
  ListProductsDto,
  ProductIdMessage,
  UpdateProductDto,
  UpdateProductMessage,
} from '@app/contracts';
import type { AuthUser } from '@app/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { sendRpc } from '../common/send-rpc';
import {
  ProductPageResponseDto,
  ProductResponseDto,
  StockSummaryResponseDto,
} from './dto/product-response.dto';

// No @Roles: every role operates the ERP without restrictions (RN-16.3)
@ApiTags('products')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('products')
export class ProductsController {
  constructor(@Inject(ERP_SERVICE) private readonly erpClient: ClientProxy) {}

  /** List products (deleted ones excluded) with search, filters, sorting and pagination */
  @Get()
  @ApiOkResponse({ type: ProductPageResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query params' })
  list(@Query() query: ListProductsDto) {
    return sendRpc<ProductPageResponseDto, ListProductsDto>(
      this.erpClient,
      ERP_PATTERNS.LIST_PRODUCTS,
      query,
    );
  }

  /** Count of products in each stock status, for the inventory indicators */
  // Declared before ':id' so "stock-summary" is not parsed as an id
  @Get('stock-summary')
  @ApiOkResponse({ type: StockSummaryResponseDto })
  stockSummary() {
    return sendRpc<StockSummaryResponseDto>(
      this.erpClient,
      ERP_PATTERNS.STOCK_SUMMARY,
      {},
    );
  }

  /** Get a product by id */
  @Get(':id')
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Product not found or deleted' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return sendRpc<ProductResponseDto, ProductIdMessage>(
      this.erpClient,
      ERP_PATTERNS.GET_PRODUCT,
      { id },
    );
  }

  /** Create a product; a positive initial stock is recorded as an Income movement */
  @Post()
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid body, missing category or decimal quantity on a Unit product',
  })
  @ApiConflictResponse({ description: 'SKU already exists' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateProductDto) {
    return sendRpc<ProductResponseDto, CreateProductMessage>(
      this.erpClient,
      ERP_PATTERNS.CREATE_PRODUCT,
      { userId: user.userId, product: dto },
    );
  }

  /** Update product data; stock is not editable here (use stock-movements) */
  @Patch(':id')
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiBadRequestResponse({
    description:
      'Invalid body, missing category or decimal quantity on a Unit product',
  })
  @ApiNotFoundResponse({ description: 'Product not found or deleted' })
  @ApiConflictResponse({ description: 'SKU already exists' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return sendRpc<ProductResponseDto, UpdateProductMessage>(
      this.erpClient,
      ERP_PATTERNS.UPDATE_PRODUCT,
      { id, product: dto },
    );
  }

  /** Logical delete: the product stays in history but leaves the catalog (RN-04) */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Product deleted' })
  @ApiNotFoundResponse({ description: 'Product not found or already deleted' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await sendRpc<void, ProductIdMessage>(
      this.erpClient,
      ERP_PATTERNS.DELETE_PRODUCT,
      { id },
    );
  }

  /** Manual stock adjustment with a reason; recorded as an Adjustment movement */
  @Post(':id/stock-movements')
  @ApiCreatedResponse({
    type: ProductResponseDto,
    description: 'The product with its updated stock',
  })
  @ApiBadRequestResponse({
    description: 'Invalid body or decimal quantity on a Unit product',
  })
  @ApiNotFoundResponse({ description: 'Product not found or deleted' })
  @ApiConflictResponse({ description: 'Insufficient stock (RN-02)' })
  adjustStock(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return sendRpc<ProductResponseDto, AdjustStockMessage>(
      this.erpClient,
      ERP_PATTERNS.ADJUST_STOCK,
      { id, userId: user.userId, adjustment: dto },
    );
  }
}
