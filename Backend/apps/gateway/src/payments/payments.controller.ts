import { Body, Controller, Inject, Post } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiGatewayTimeoutResponse,
  ApiNotFoundResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CreatePaymentDto,
  PAYMENTS_PATTERNS,
  PAYMENTS_SERVICE,
} from '@app/contracts';
import { Roles } from '../auth/roles.decorator';
import { sendRpc } from '../common/send-rpc';
import { PAYMENT_TCP_TIMEOUT_MS } from '../config/tcp';
import {
  PaymentResponseDto,
  SaleNotPayableResponseDto,
} from './dto/payment-response.dto';

// Payments are Owner/Admin by default (RN-16.3). Each route that Employees may
// use overrides it on the handler, which RolesGuard reads first.
@ApiTags('payments')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Roles('Owner', 'Admin')
@Controller('payments')
export class PaymentsController {
  constructor(
    @Inject(PAYMENTS_SERVICE) private readonly paymentsClient: ClientProxy,
  ) {}

  // Employees run the counter, so they can open the checkout of a sale (RN-16.3)
  /**
   * Open the Mercado Pago checkout of a sale in Ordered (any role). Amount and
   * items come from the ERP. If the sale already has an open checkout, that one
   * is returned instead of creating a second order, so the call is safe to repeat.
   */
  @Roles('Owner', 'Admin', 'Employee')
  @Post()
  @ApiCreatedResponse({ type: PaymentResponseDto })
  @ApiBadRequestResponse({ description: 'saleId is missing or not a UUID' })
  @ApiNotFoundResponse({ description: 'Sale not found' })
  @ApiConflictResponse({
    type: SaleNotPayableResponseDto,
    description:
      'The sale is not in Ordered (code SALE_NOT_PAYABLE), or another request is still creating its checkout (no code: retry)',
  })
  @ApiBadGatewayResponse({ description: 'Mercado Pago rejected the request' })
  @ApiServiceUnavailableResponse({
    description: 'Mercado Pago or the ERP is unavailable; nothing was charged',
  })
  @ApiGatewayTimeoutResponse({ description: 'Payments service timed out' })
  create(@Body() dto: CreatePaymentDto) {
    return sendRpc<PaymentResponseDto, CreatePaymentDto>(
      this.paymentsClient,
      PAYMENTS_PATTERNS.CREATE_PAYMENT,
      dto,
      PAYMENT_TCP_TIMEOUT_MS,
    );
  }
}
