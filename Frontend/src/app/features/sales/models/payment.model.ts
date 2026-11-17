export type PaymentState = 'Pending' | 'Paid' | 'Rejected';

export type PaymentMethod = 'mercadopago';

export interface PaymentBackUrls {
  success: string;
  failure: string;
  pending: string;
}

export interface CreatePaymentRequest {
  saleId: string;
  payer?: { name?: string; email?: string };
  backUrls: PaymentBackUrls;
}

export interface CreatePaymentResponse {
  /** URL del checkout de Mercado Pago a la que se redirige al usuario. */
  initPoint: string;
  paymentId?: string;
}

export interface Payment {
  id: string;
  saleId: string;
  paymentState: PaymentState;
  amount: number;
}
