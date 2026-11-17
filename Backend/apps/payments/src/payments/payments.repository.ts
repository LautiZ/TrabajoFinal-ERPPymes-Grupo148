import { Injectable } from '@nestjs/common';
import { Payment } from '../generated/prisma/client';
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
