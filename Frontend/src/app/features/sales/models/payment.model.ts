export type PaymentState = 'Pending' | 'Paid' | 'Rejected' | 'Refunded';

export type PaymentMethod = 'mercadopago';

/**
 * Para generar el pago solo hace falta el id de la venta: el backend toma de ella el monto y los
 * ítems (RN-13) y define las URLs de retorno de Mercado Pago. El Gateway rechaza cualquier otro campo.
 */
export interface CreatePaymentRequest {
  saleId: string;
}

export interface Payment {
  id: string;
  saleId: string;
  amount: number;
  state: PaymentState;
  /** Checkout de Mercado Pago al que se redirige al comprador; `null` cuando el intento ya se cerró. */
  checkoutUrl: string | null;
  createdAt: string;
}
