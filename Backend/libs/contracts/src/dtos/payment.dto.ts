import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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

// Error code on a 409 when the sale is past its payment window (TES-75)
export const SALE_PAYMENT_EXPIRED = 'SALE_PAYMENT_EXPIRED';

// The client only says which sale to pay: the amount comes from the ERP (RN-13)
export class CreatePaymentDto {
  @IsUUID()
  saleId!: string;
}

export class SalePaymentMessage {
  @IsUUID()
  saleId!: string;
}

// What the gateway forwards from a Mercado Pago webhook. Everything is optional
// because the request is public: the Payments MS decides what is valid, and
// never trusts these values beyond using dataId to fetch the order again.
export class PaymentNotificationMessage {
  /** Notification topic; only "order" is processed */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  type?: string;

  /** Id of the Mercado Pago resource (the order id): ?data.id, else body.data.id */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  dataId?: string;

  /** ?data.id exactly as received: the only id Mercado Pago signs */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  signedDataId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  xSignature?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  xRequestId?: string;
}

// Response shape shared by the Payments MS (producer) and the gateway (docs)
export interface PaymentView {
  id: string;
  saleId: string;
  amount: number;
  state: PaymentState;
  /** Mercado Pago checkout to redirect the buyer to; null once the attempt is closed */
  checkoutUrl: string | null;
  /** Mercado Pago payment id: the payment reference of the receipt; null until paid */
  mpPaymentId: string | null;
  createdAt: Date;
}
