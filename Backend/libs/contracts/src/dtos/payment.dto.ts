import { IsUUID } from 'class-validator';

// Mirrors the Payments Prisma enum; contracts must not depend on a service's generated client
export const PAYMENT_STATES = [
  'Pending',
  'Paid',
  'Rejected',
  'Refunded',
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

// Error code the frontend can look for on a 409 when the sale cannot be paid
export const SALE_NOT_PAYABLE = 'SALE_NOT_PAYABLE';

// The client only says which sale to pay: the amount comes from the ERP (RN-13)
export class CreatePaymentDto {
  @IsUUID()
  saleId!: string;
}

// Response shape shared by the Payments MS (producer) and the gateway (docs)
export interface PaymentView {
  id: string;
  saleId: string;
  amount: number;
  state: PaymentState;
  /** Mercado Pago checkout to redirect the buyer to; null once the attempt is closed */
  checkoutUrl: string | null;
  createdAt: Date;
}
