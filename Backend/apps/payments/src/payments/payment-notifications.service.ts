import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { SALE_CANCELLED } from '@app/contracts';
import type { PaymentNotificationMessage } from '@app/contracts';
import { rpcError } from '../common/rpc-error';
import { SalesClient } from '../erp/sales.client';
import { Payment } from '../generated/prisma/client';
import {
  MercadoPagoClient,
  ProviderOrder,
} from '../mercadopago/mercadopago.client';
import { canTransition, sourcesOf, toPaymentState } from './order-status';
import { PaymentsRepository } from './payments.repository';

const toCents = (amount: number) => Math.round(amount * 100);

const rpcPayloadOf = (err: unknown) =>
  err instanceof RpcException
    ? (err.getError() as { status?: unknown; code?: unknown })
    : undefined;

const rpcStatusOf = (err: unknown) => {
  const status = rpcPayloadOf(err)?.status;
  return typeof status === 'number' ? status : undefined;
};

const isSaleCancelled = (err: unknown) =>
  rpcPayloadOf(err)?.code === SALE_CANCELLED;

/**
 * Applies a Mercado Pago webhook (TES-29). The body is never trusted: the
 * signature proves who sent it, and the order is read again from the Orders
 * API to learn its real state. Safe to repeat: a notification that changes
 * nothing is simply acknowledged.
 *
 * Returning normally means "done" (the gateway answers 200). Throwing a
 * transient error (ERP or Mercado Pago down) makes Mercado Pago retry later.
 */
@Injectable()
export class PaymentNotificationsService {
  private readonly logger = new Logger(PaymentNotificationsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly salesClient: SalesClient,
    private readonly mercadoPago: MercadoPagoClient,
  ) {}

  async handle(notification: PaymentNotificationMessage): Promise<void> {
    const { type, dataId } = notification;
    if (type !== 'order' || !dataId) {
      this.logger.debug(`Ignored notification (type ${type ?? '-'})`);
      return;
    }
    const signature = {
      dataId: notification.signedDataId,
      xSignature: notification.xSignature,
      xRequestId: notification.xRequestId,
    };
    if (!this.mercadoPago.isAuthenticNotification(signature)) {
      throw rpcError(401, 'Invalid notification signature');
    }

    const payment = await this.paymentsRepository.findByOrderId(dataId);
    if (!payment) {
      this.logger.warn(`Notification for unknown order ${dataId}`);
      return;
    }

    const order = await this.mercadoPago.getOrder(dataId);
    if (order.externalReference !== payment.saleId) {
      this.logger.error(
        `Order ${order.id} references sale ${order.externalReference}, payment ${payment.id} belongs to ${payment.saleId}`,
      );
      return;
    }

    const target = toPaymentState(order.status);
    if (!target || !canTransition(payment.paymentState, target)) return;

    if (target === 'Paid') {
      if (!this.chargedInFull(order, payment)) return;
      // Before recording the payment: if the ERP fails, the payment stays
      // Pending and the retried notification confirms the sale again
      await this.confirmSale(payment.saleId, order.id);

      // A rejected attempt can still be paid after a newer one was: two charges
      const other = await this.paymentsRepository.findOtherPaid(
        payment.saleId,
        payment.id,
      );
      if (other) {
        this.logger.error(
          `Sale ${payment.saleId} was already paid by payment ${other.id}: order ${order.id} is a duplicate charge, refund needed`,
        );
      }
    }

    const changed = await this.paymentsRepository.transition(
      payment.id,
      sourcesOf(target),
      target,
      order.paymentId,
    );
    if (changed) {
      this.logger.log(`Payment ${payment.id} is now ${target}`);
    }
  }

  // RN-13: the order total must be the sale total stored on the payment, and
  // the paid amount must cover it. A paid amount of 0 means the API left the
  // field out, so the processed status is trusted alone.
  private chargedInFull(order: ProviderOrder, payment: Payment): boolean {
    const total = toCents(Number(payment.amount));
    const paid = toCents(order.paidAmount);
    if (toCents(order.totalAmount) === total && (paid === 0 || paid >= total)) {
      return true;
    }
    this.logger.error(
      `Order ${order.id} (total ${order.totalAmount}, paid ${order.paidAmount}) does not match payment ${payment.id} amount ${String(payment.amount)}`,
    );
    return false;
  }

  private async confirmSale(saleId: string, orderId: string): Promise<void> {
    try {
      await this.salesClient.markPaid(saleId);
    } catch (err) {
      // ERP down (5xx, 503 on timeout): throw so Mercado Pago retries later
      const status = rpcStatusOf(err);
      if (status === undefined || status >= 500) throw err;

      // A 4xx will not change on retry. The money arrived, so the payment is
      // still recorded as Paid; the refund (TES-75) needs a person.
      this.logger.error(
        isSaleCancelled(err)
          ? `Sale ${saleId} was cancelled but order ${orderId} was paid: refund needed`
          : `ERP refused to mark sale ${saleId} as paid (status ${status}) for order ${orderId}: check it by hand`,
      );
    }
  }
}
