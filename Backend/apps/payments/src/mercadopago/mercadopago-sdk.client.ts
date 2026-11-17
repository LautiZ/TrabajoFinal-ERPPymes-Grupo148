import { Inject, Injectable } from '@nestjs/common';
import { MercadoPagoConfig, Order } from 'mercadopago';
import { rpcError } from '../common/rpc-error';
import { translateMercadoPagoError } from './mercadopago-errors';
import {
  CreateCheckoutInput,
  CreatedCheckout,
  MercadoPagoClient,
  ProviderOrder,
} from './mercadopago.client';

export const MERCADOPAGO_OPTIONS = Symbol('MERCADOPAGO_OPTIONS');

export interface MercadoPagoOptions {
  accessToken: string;
  timeoutMs: number;
}

const toCents = (amount: number) => Math.round(amount * 100);
const formatCents = (cents: number) => (cents / 100).toFixed(2);

// Adapter over the official SDK (Orders API). Every call goes through `call`,
// so SDK errors always leave this class already translated to RPC errors.
@Injectable()
export class MercadoPagoSdkClient extends MercadoPagoClient {
  private readonly orders: Order;

  constructor(@Inject(MERCADOPAGO_OPTIONS) options: MercadoPagoOptions) {
    super();
    this.orders = new Order(
      new MercadoPagoConfig({
        accessToken: options.accessToken,
        options: { timeout: options.timeoutMs },
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
            external_code: item.id,
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
    };
  }

  private async call<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch (error) {
      throw translateMercadoPagoError(error);
    }
  }
}
