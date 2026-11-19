import { Inject, Injectable, Logger } from '@nestjs/common';
import { SALE_NOT_PAYABLE, SALE_PAYMENT_EXPIRED } from '@app/contracts';
import type {
  CreatePaymentDto,
  PaymentView,
  SalePaymentMessage,
} from '@app/contracts';
import { rpcError } from './common/rpc-error';
import { SalesClient } from './erp/sales.client';
import { Payment } from './generated/prisma/client';
import {
  CreatedCheckout,
  MercadoPagoClient,
} from './mercadopago/mercadopago.client';
import { toCheckoutItems } from './payments/checkout-items';
import { CHECKOUT_OPTIONS } from './payments/checkout-options';
import type { CheckoutOptions } from './payments/checkout-options';
import { PaymentsRepository } from './payments/payments.repository';

// A request lives at most 15 s (gateway timeout). A reservation without a
// checkout that is older than this belongs to a request that died, and would
// otherwise block the sale forever through the one-Pending-per-sale index.
export const STALE_RESERVATION_MS = 30_000;

const isStaleReservation = (payment: Payment) =>
  !payment.checkoutUrl &&
  Date.now() - payment.createdAt.getTime() > STALE_RESERVATION_MS;

const toView = (payment: Payment): PaymentView => ({
  id: payment.id,
  saleId: payment.saleId,
  amount: Number(payment.amount),
  state: payment.paymentState,
  // Only a Pending attempt can still be paid: closed ones hide their checkout
  checkoutUrl: payment.paymentState === 'Pending' ? payment.checkoutUrl : null,
  mpPaymentId: payment.mpPaymentId,
  createdAt: payment.createdAt,
});

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly salesClient: SalesClient,
    private readonly mercadoPago: MercadoPagoClient,
    @Inject(CHECKOUT_OPTIONS) private readonly options: CheckoutOptions,
  ) {}

  countPayments(): Promise<number> {
    return this.paymentsRepository.count();
  }

  // Opens (or resumes) the Mercado Pago checkout of a sale. The amount and the
  // items always come from the ERP, never from the client (RN-13).
  async create({ saleId }: CreatePaymentDto): Promise<PaymentView> {
    const sale = await this.salesClient.getSale(saleId);
    if (sale.currentState !== 'Ordered') {
      throw rpcError(
        409,
        `Sale is not awaiting payment (current state: ${sale.currentState})`,
        { code: SALE_NOT_PAYABLE },
      );
    }

    const open = await this.paymentsRepository.findPendingBySale(saleId);
    if (open && isStaleReservation(open)) {
      this.logger.warn(`Releasing abandoned reservation ${open.id}`);
      await this.paymentsRepository.releaseIfUnattached(open.id);
    } else if (open) {
      return this.resume(open);
    }

    // A new order is payable for one more window, and the ERP cancels unpaid
    // sales after two: past the first, a new checkout could outlive the sale
    const windowMs = this.options.paymentWindowMinutes * 60_000;
    if (Date.now() - new Date(sale.createdAt).getTime() > windowMs) {
      throw rpcError(
        409,
        `The payment window of this sale has expired (${this.options.paymentWindowMinutes} min): register it again`,
        { code: SALE_PAYMENT_EXPIRED },
      );
    }

    const reserved = await this.paymentsRepository.reservePending(
      saleId,
      sale.total,
    );
    // A concurrent request reserved first: answer with its payment
    if (!reserved) {
      return this.resume(
        await this.paymentsRepository.findPendingBySale(saleId),
      );
    }

    let checkout: CreatedCheckout;
    try {
      checkout = await this.mercadoPago.createCheckout({
        externalReference: saleId,
        idempotencyKey: reserved.id,
        items: toCheckoutItems(sale),
        backUrls: {
          success: `${this.options.frontendUrl}/payments/success`,
          failure: `${this.options.frontendUrl}/payments/failure`,
          pending: `${this.options.frontendUrl}/payments/pending`,
        },
        autoReturn: true,
        expirationMinutes: this.options.paymentWindowMinutes,
      });
    } catch (err) {
      // Free the slot so the client can retry; an order Mercado Pago may have
      // created anyway is never shown to anyone, so it is never paid
      await this.paymentsRepository
        .releaseIfUnattached(reserved.id)
        .catch((releaseErr: unknown) =>
          // The stale check frees it later; the client must see the real cause
          this.logger.error(
            `Could not release reservation ${reserved.id}: ${String(releaseErr)}`,
          ),
        );
      throw err;
    }

    try {
      return toView(
        await this.paymentsRepository.attachCheckout(reserved.id, checkout),
      );
    } catch (err) {
      // The order exists in Mercado Pago but was not stored. The row is kept
      // (the stale check releases it later); the ids are logged to reconcile.
      this.logger.error(
        `Order ${checkout.orderId} created but not stored on payment ${reserved.id}`,
      );
      throw err;
    }
  }

  // The payment of a sale: the attempt that paid it, else the latest one.
  // Polled after the buyer returns from Mercado Pago (the state comes from the
  // webhook, never from the return URL) and used for the receipt (TES-76).
  async getBySale({ saleId }: SalePaymentMessage): Promise<PaymentView> {
    const payment = await this.paymentsRepository.findCurrentBySale(saleId);
    if (!payment) throw rpcError(404, 'The sale has no payment');
    return toView(payment);
  }

  // The open payment already has its checkout, or another request is still
  // creating it (or just gave up): either way no second order is created
  private resume(open: Payment | null): PaymentView {
    if (!open?.checkoutUrl) {
      throw rpcError(
        409,
        'A payment for this sale is being created, retry in a moment',
      );
    }
    return toView(open);
  }
}
