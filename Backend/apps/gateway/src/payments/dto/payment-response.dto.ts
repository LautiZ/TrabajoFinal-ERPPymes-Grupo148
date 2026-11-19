import { ApiProperty } from '@nestjs/swagger';
import {
  PAYMENT_STATES,
  SALE_NOT_PAYABLE,
  SALE_PAYMENT_EXPIRED,
  type PaymentState,
  type PaymentView,
} from '@app/contracts';

// HTTP response shapes only: documented for Swagger, not validated.
// `implements` keeps them in sync with what the Payments MS returns.
export class PaymentResponseDto implements PaymentView {
  id!: string;
  saleId!: string;
  /** Sale total taken from the ERP, never from the client (RN-13) @example 3001.5 */
  amount!: number;
  @ApiProperty({ enum: PAYMENT_STATES, example: 'Pending' })
  state!: PaymentState;
  /**
   * Mercado Pago checkout: redirect the buyer here. After paying, Mercado Pago
   * sends them back to /payments/success, /payments/failure or /payments/pending
   * @example https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD01...
   */
  checkoutUrl!: string | null;
  createdAt!: Date;
}

export class SaleNotPayableResponseDto {
  /** @example 409 */
  statusCode!: number;
  /** @example Sale is not awaiting payment (current state: Paid) */
  message!: string;
  @ApiProperty({ enum: [SALE_NOT_PAYABLE, SALE_PAYMENT_EXPIRED] })
  code!: typeof SALE_NOT_PAYABLE | typeof SALE_PAYMENT_EXPIRED;
}
