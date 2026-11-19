import { Injectable } from '@nestjs/common';
import { Payment, PaymentState } from '../generated/prisma/client';
import { CreatedCheckout } from '../mercadopago/mercadopago.client';
import { isUniqueViolation } from '../prisma/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.payment.count();
  }

  findPendingBySale(saleId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: { saleId, paymentState: 'Pending' },
    });
  }

  // Returns null when the sale already has a Pending payment: the partial
  // unique index uq_payments_sale_id_pending lets only one request win
  async reservePending(
    saleId: string,
    amount: number,
  ): Promise<Payment | null> {
    try {
      return await this.prisma.payment.create({ data: { saleId, amount } });
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  attachCheckout(id: string, checkout: CreatedCheckout): Promise<Payment> {
    return this.prisma.payment.update({
      where: { id },
      data: { mpOrderId: checkout.orderId, checkoutUrl: checkout.checkoutUrl },
    });
  }

  findByOrderId(mpOrderId: string): Promise<Payment | null> {
    return this.prisma.payment.findUnique({ where: { mpOrderId } });
  }

  // The attempt that represents the sale: the one that paid it (the first, if
  // a duplicate charge happened), otherwise the latest. A newer attempt can
  // exist next to the paid one when a late payment arrives, so "latest" alone
  // could show a Pending or Rejected attempt for a paid sale.
  async findCurrentBySale(saleId: string): Promise<Payment | null> {
    const paid = await this.prisma.payment.findFirst({
      where: { saleId, paymentState: 'Paid' },
      orderBy: { createdAt: 'asc' },
    });
    return (
      paid ??
      this.prisma.payment.findFirst({
        where: { saleId },
        orderBy: { createdAt: 'desc' },
      })
    );
  }

  // Another attempt of the same sale that was already paid (double charge)
  findOtherPaid(saleId: string, excludeId: string): Promise<Payment | null> {
    return this.prisma.payment.findFirst({
      where: { saleId, paymentState: 'Paid', id: { not: excludeId } },
    });
  }

  // Conditional on the current state, so two concurrent notifications cannot
  // both apply the same change. Returns false when another one already did.
  // The checkout url is kept: chk_payments_order_checkout_url requires it
  // while mp_order_id is set. The view hides it once the attempt is closed.
  async transition(
    id: string,
    from: PaymentState[],
    to: PaymentState,
    mpPaymentId: string | null,
  ): Promise<boolean> {
    const { count } = await this.prisma.payment.updateMany({
      where: { id, paymentState: { in: from } },
      data: {
        paymentState: to,
        ...(mpPaymentId && { mpPaymentId }),
      },
    });
    return count > 0;
  }

  // Deletes a reservation that never got its checkout. Conditional on purpose:
  // if a concurrent request already attached one (or deleted it), nothing
  // happens and false is returned
  async releaseIfUnattached(id: string): Promise<boolean> {
    const { count } = await this.prisma.payment.deleteMany({
      where: { id, paymentState: 'Pending', checkoutUrl: null },
    });
    return count > 0;
  }
}
