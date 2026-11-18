import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Query,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBody,
  ApiHeader,
  ApiOkResponse,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  PAYMENTS_PATTERNS,
  PAYMENTS_SERVICE,
  PaymentNotificationMessage,
} from '@app/contracts';
import { Public } from '../auth/public.decorator';
import { sendRpc } from '../common/send-rpc';
import { PAYMENT_TCP_TIMEOUT_MS } from '../config/tcp';

// Loose on purpose: Mercado Pago sends many fields (action, api_version,
// live_mode...). Typed as a plain object so the global ValidationPipe
// (forbidNonWhitelisted) does not reject them; only type and data.id are read.
interface NotificationBody {
  type?: unknown;
  data?: { id?: unknown };
}

const asString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined;

// Separate controller: PaymentsController requires roles, and Mercado Pago
// calls this without a session
@ApiTags('payments')
@Controller('payments/webhook')
export class PaymentsWebhookController {
  constructor(
    @Inject(PAYMENTS_SERVICE) private readonly paymentsClient: ClientProxy,
  ) {}

  /**
   * Mercado Pago webhook (topic Order). Public: authenticity is checked with
   * the x-signature header, and the order is read again from Mercado Pago, so
   * the body is never trusted. Updates the payment and, when paid, the sale.
   * Repeated notifications change nothing. In development expose it with a
   * tunnel (ngrok http 3000) and register https://<tunnel>/api/payments/webhook
   * in the Mercado Pago app (Webhooks > Configurar notificaciones > Order).
   */
  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiQuery({
    name: 'data.id',
    required: false,
    example: 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3',
  })
  @ApiQuery({ name: 'type', required: false, example: 'order' })
  @ApiHeader({
    name: 'x-signature',
    required: false,
    example: 'ts=1742505638683,v1=ced36ab6...',
  })
  @ApiHeader({ name: 'x-request-id', required: false })
  @ApiBody({
    required: false,
    schema: {
      type: 'object',
      example: {
        type: 'order',
        action: 'order.processed',
        data: { id: 'ORD01JQ4S4KY8HWQ6NA5PXB65B3D3' },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Notification processed or ignored (not ours, in progress, repeated)',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing signature' })
  @ApiServiceUnavailableResponse({
    description: 'ERP or Mercado Pago unavailable: Mercado Pago retries later',
  })
  async handle(
    @Query('type') queryType: unknown,
    @Query('data.id') queryDataId: unknown,
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Body() body: NotificationBody = {},
  ): Promise<void> {
    await sendRpc<void, PaymentNotificationMessage>(
      this.paymentsClient,
      PAYMENTS_PATTERNS.HANDLE_NOTIFICATION,
      {
        type: asString(queryType) ?? asString(body?.type),
        dataId: asString(queryDataId) ?? asString(body?.data?.id),
        // Mercado Pago signs only the query param, never the body id
        signedDataId: asString(queryDataId),
        xSignature: asString(xSignature),
        xRequestId: asString(xRequestId),
      },
      PAYMENT_TCP_TIMEOUT_MS,
    );
  }
}
