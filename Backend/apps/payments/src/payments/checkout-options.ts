export const CHECKOUT_OPTIONS = Symbol('CHECKOUT_OPTIONS');

export interface CheckoutOptions {
  // Base URL of the frontend: Mercado Pago sends the buyer back to
  // /payments/success, /payments/failure or /payments/pending under it
  frontendUrl: string;
  // SALE_PAYMENT_WINDOW_MINUTES: how long after the sale a payment can be
  // opened, and how long each Mercado Pago order stays payable (TES-75)
  paymentWindowMinutes: number;
}
