// Port to Mercado Pago (Checkout Pro via the Orders API). The abstract class
// doubles as the Nest injection token, so services depend on it and tests
// swap it for a plain mock.
export interface CheckoutItem {
  // Business code shown in Mercado Pago reports (the product SKU)
  code: string;
  title: string;
  // Whole units: weighed products (Kg) go as a single line priced at their
  // subtotal, so the order total always matches the sale total exactly
  quantity: number;
  unitPrice: number;
}

export interface CreateCheckoutInput {
  // Our sale id: Mercado Pago echoes it back on the order and its webhooks
  externalReference: string;
  // One key per payment attempt: a retried request never creates two orders
  idempotencyKey: string;
  items: CheckoutItem[];
  backUrls: { success: string; failure: string; pending: string };
  // Redirect to the success URL right after an approved payment
  autoReturn: boolean;
}

export interface CreatedCheckout {
  orderId: string;
  checkoutUrl: string;
}

export interface ProviderOrder {
  id: string;
  // Raw Orders API status: created, processing, action_required, processed,
  // failed, canceled, refunded. Paid means processed + accredited.
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  totalAmount: number;
  paidAmount: number;
}

export abstract class MercadoPagoClient {
  abstract createCheckout(input: CreateCheckoutInput): Promise<CreatedCheckout>;

  abstract getOrder(id: string): Promise<ProviderOrder>;
}
