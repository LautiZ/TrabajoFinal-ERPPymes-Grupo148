import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Order,
  WebhookSignatureValidator,
} from 'mercadopago';
import { rpcError } from '../common/rpc-error';
import { translateMercadoPagoError } from './mercadopago-errors';
import {
  CreateCheckoutInput,
  CreatedCheckout,
  MercadoPagoClient,
  NotificationSignature,
  ProviderOrder,
} from './mercadopago.client';

export const MERCADOPAGO_OPTIONS = Symbol('MERCADOPAGO_OPTIONS');

export interface MercadoPagoOptions {
  accessToken: string;
  timeoutMs: number;
  // Secret signature of the app's webhooks; empty means every notification is rejected
  webhookSecret: string;
}

// The API rejects longer codes with a 400
const MAX_EXTERNAL_CODE_LENGTH = 30;

const toCents = (amount: number) => Math.round(amount * 100);

// An order lists every card attempt (a rejected card, then the approved one):
// the payment that counts is the approved one, else the latest attempt
const pickPaymentId = (
  payments: { id?: string; status?: string }[] = [],
): string | null =>
  (
    payments.find((p) => p.status === 'processed' || p.status === 'approved') ??
    payments.at(-1)
  )?.id ?? null;
const formatCents = (cents: number) => (cents / 100).toFixed(2);

// Adapter over the official SDK (Orders API). Every call goes through `call`,
// so SDK errors always leave this class already translated to RPC errors.
@Injectable()
export class MercadoPagoSdkClient extends MercadoPagoClient {
  private readonly logger = new Logger(MercadoPagoSdkClient.name);
  private readonly orders: Order;
  private readonly webhookSecret: string;

  constructor(@Inject(MERCADOPAGO_OPTIONS) options: MercadoPagoOptions) {
    super();
    this.webhookSecret = options.webhookSecret;
    this.orders = new Order(
      new MercadoPagoConfig({
        accessToken: options.accessToken,
        // One retry at most: the SDK default (3, with backoff up to 30 s) would
        // outlive the gateway timeout of the payment route
        options: { timeout: options.timeoutMs, maxRetries: 1 },
      }),
    );
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout> {
    // The API requires total_amount to equal the sum of unit_price x quantity
    // exactly, so the total is computed here in cents from the same values
    const totalCents = input.items.reduce(
      (sum, item) => sum + toCents(item.unitPrice) * item.quantity,
      0,
    );

    const order = await this.call(() =>
      this.orders.create({
        body: {
          type: 'online',
          processing_mode: 'manual',
          external_reference: input.externalReference,
          total_amount: formatCents(totalCents),
          items: input.items.map((item) => ({
            external_code: item.code.slice(0, MAX_EXTERNAL_CODE_LENGTH),
            title: item.title,
            quantity: item.quantity,
            unit_price: formatCents(toCents(item.unitPrice)),
          })),
          config: {
            online: {
              success_url: input.backUrls.success,
              failure_url: input.backUrls.failure,
              pending_url: input.backUrls.pending,
              ...(input.autoReturn && { auto_return: 'approved' as const }),
            },
          },
        },
        requestOptions: { idempotencyKey: input.idempotencyKey },
      }),
    );

    if (!order.id || !order.checkout_url) {
      throw rpcError(502, 'Payment provider returned an incomplete order');
    }
    return { orderId: order.id, checkoutUrl: order.checkout_url };
  }

  async getOrder(id: string): Promise<ProviderOrder> {
    const order = await this.call(() => this.orders.get({ id }));
    return {
      id: String(order.id),
      status: order.status ?? 'unknown',
      statusDetail: order.status_detail ?? null,
      externalReference: order.external_reference ?? null,
      totalAmount: Number(order.total_amount ?? 0),
      paidAmount: Number(order.total_paid_amount ?? 0),
      paymentId: pickPaymentId(order.transactions?.payments),
    };
  }

  isAuthenticNotification({
    dataId,
    xSignature,
    xRequestId,
  }: NotificationSignature): boolean {
    if (!this.webhookSecret) {
      this.logger.error('MP_WEBHOOK_SECRET is not set: notification rejected');
      return false;
    }
    try {
      WebhookSignatureValidator.validate({
        xSignature,
        xRequestId,
        // Mercado Pago signs alphanumeric ids (ORD01...) in lowercase, but sends
        // them uppercase; the SDK does not convert them
        dataId: dataId?.toLowerCase(),
        secret: this.webhookSecret,
        // No timestamp tolerance on purpose: MP docs disagree on whether ts is
        // in seconds or milliseconds, and a replay is harmless anyway because
        // the state is always read again from the Orders API
      });
      return true;
    } catch (error) {
      if (!(error instanceof InvalidWebhookSignatureError)) throw error;
      this.logger.warn(
        `Rejected notification (${error.reason}, request ${error.requestId ?? '-'})`,
      );
      return false;
    }
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw translateMercadoPagoError(error);
    }
  }
}
