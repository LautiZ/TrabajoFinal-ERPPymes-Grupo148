export const CHECKOUT_OPTIONS = Symbol('CHECKOUT_OPTIONS');

export interface CheckoutOptions {
  // Base URL of the frontend: Mercado Pago sends the buyer back to
  // /payments/success, /payments/failure or /payments/pending under it
  frontendUrl: string;
}
