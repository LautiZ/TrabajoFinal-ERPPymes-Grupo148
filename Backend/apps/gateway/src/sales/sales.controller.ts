import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
  AUTH_PATTERNS,
  AUTH_SERVICE,
  CreateSaleDto,
  CreateSaleMessage,
  ERP_PATTERNS,
  ERP_SERVICE,
  ListSalesDto,
  PAYMENTS_PATTERNS,
  PAYMENTS_SERVICE,
  SaleIdMessage,
  SaleTransitionMessage,
} from '@app/contracts';
import type {
  AuthUser,
  PaymentView,
  SalePaymentMessage,
  SaleReceiptView,
  UserIdMessage,
  UserSummaryView,
} from '@app/contracts';
import { CurrentUser } from '../auth/current-user.decorator';
import { sendRpc } from '../common/send-rpc';
import {
  ReceiptResponseDto,
  SaleNotPaidResponseDto,
} from './dto/receipt-response.dto';
import {
  InsufficientStockResponseDto,
  InvalidSaleStateResponseDto,
  SalePageResponseDto,
  SaleResponseDto,
} from './dto/sale-response.dto';

// No @Roles: every role registers sales (RN-16.3) and hands out receipts
@ApiTags('sales')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('sales')
export class SalesController {
  constructor(
    @Inject(ERP_SERVICE) private readonly erpClient: ClientProxy,
    @Inject(AUTH_SERVICE) private readonly authClient: ClientProxy,
    @Inject(PAYMENTS_SERVICE) private readonly paymentsClient: ClientProxy,
  ) {}

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

  /**
   * Cancel an Ordered sale from the point of sale and return its stock
   * (RN-09.1, RN-11). A paid sale cannot be cancelled here: that would need a
   * refund in Mercado Pago. The history step records the acting user (RN-10).
   */
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SaleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Sale not found' })
  @ApiConflictResponse({
    type: InvalidSaleStateResponseDto,
    description: 'The sale is not Ordered, code INVALID_SALE_STATE',
  })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return sendRpc<SaleResponseDto, SaleTransitionMessage>(
      this.erpClient,
      ERP_PATTERNS.CANCEL_SALE_BY_USER,
      { id, userId: user.userId },
    );
  }

  /**
   * Mark a Paid sale as Dispatched (RN-09). From then on it can no longer be
   * cancelled (RN-09.1). The history step records the acting user (RN-10).
   */
  @Post(':id/dispatch')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SaleResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Sale not found' })
  @ApiConflictResponse({
    type: InvalidSaleStateResponseDto,
    description: 'The sale is not Paid, code INVALID_SALE_STATE',
  })
  dispatch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return sendRpc<SaleResponseDto, SaleTransitionMessage>(
      this.erpClient,
      ERP_PATTERNS.DISPATCH_SALE,
      { id, userId: user.userId },
    );
  }

  /**
   * Receipt of a paid sale (TES-76): unique correlative number, date, seller,
   * items with price and subtotal, total and the Mercado Pago payment reference.
   * Not a fiscal invoice. Composed here because each service owns its data:
   * items and number come from the ERP, the seller from Auth, the payment from
   * Payments.
   */
  @Get(':id/receipt')
  @ApiOkResponse({ type: ReceiptResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Sale not found' })
  @ApiConflictResponse({
    type: SaleNotPaidResponseDto,
    description:
      'The sale is not paid (Ordered or Cancelled), code SALE_NOT_PAID',
  })
  async receipt(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReceiptResponseDto> {
    // First: a missing or unpaid sale must fail before asking the others
    const { sellerId, ...receipt } = await sendRpc<
      SaleReceiptView,
      SaleIdMessage
    >(this.erpClient, ERP_PATTERNS.GET_SALE_RECEIPT, { id });

    const [seller, payment] = await Promise.all([
      orNullIfNotFound(
        sendRpc<UserSummaryView, UserIdMessage>(
          this.authClient,
          AUTH_PATTERNS.GET_USER,
          { id: sellerId },
        ),
      ),
      orNullIfNotFound(
        sendRpc<PaymentView, SalePaymentMessage>(
          this.paymentsClient,
          PAYMENTS_PATTERNS.GET_SALE_PAYMENT,
          { saleId: id },
        ),
      ),
    ]);

    return {
      ...receipt,
      seller,
      payment: payment && {
        id: payment.id,
        state: payment.state,
        mpPaymentId: payment.mpPaymentId,
      },
    };
  }
}

// A missing seller or payment record should not hide a valid receipt; any
// other error (service down, timeout) still fails the request
const orNullIfNotFound = async <T>(request: Promise<T>): Promise<T | null> => {
  try {
    return await request;
  } catch (err) {
    if ((err as { status?: unknown } | null)?.status === 404) return null;
    throw err;
  }
};
