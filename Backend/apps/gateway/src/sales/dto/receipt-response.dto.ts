import { ApiProperty } from '@nestjs/swagger';
import {
  PAYMENT_STATES,
  SALE_NOT_PAID,
  type PaymentState,
  type SaleReceiptView,
  type UserSummaryView,
} from '@app/contracts';
import { SaleItemResponseDto } from './sale-response.dto';

// HTTP response shapes only: documented for Swagger, not validated

export class ReceiptSellerDto implements UserSummaryView {
  id!: string;
  /** @example Ana */
  name!: string;
  /** @example Pérez */
  surname!: string | null;
}

export class ReceiptPaymentDto {
  /** Our payment id (Payments MS) */
  id!: string;
  /** Paid, or Refunded if the money was returned afterwards */
  @ApiProperty({ enum: PAYMENT_STATES, example: 'Paid' })
  state!: PaymentState;
  /** Mercado Pago payment id: the payment reference @example PAY01M7RGAD6FM87GHV6Z254XSXNF */
  mpPaymentId!: string | null;
}

export class ReceiptResponseDto implements Omit<SaleReceiptView, 'sellerId'> {
  /** Unique correlative assigned when the sale was paid @example 0001-00000123 */
  receiptNumber!: string;
  saleId!: string;
  /** @example 113 */
  saleNumber!: number;
  /** When the sale was paid */
  issuedAt!: Date;
  /** Employee who registered the sale (RN-12); null if Auth no longer knows the user */
  seller!: ReceiptSellerDto | null;
  items!: SaleItemResponseDto[];
  /** Sum of the item subtotals @example 9800 */
  total!: number;
  /** Payment that settled the sale; null if Payments has no record of it */
  payment!: ReceiptPaymentDto | null;
}

export class SaleNotPaidResponseDto {
  /** @example 409 */
  statusCode!: number;
  /** @example Sale is not paid (current state: Ordered) */
  message!: string;
  @ApiProperty({ enum: [SALE_NOT_PAID] })
  code!: typeof SALE_NOT_PAID;
}
