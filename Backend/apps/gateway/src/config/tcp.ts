// No retries on purpose: resending a non-idempotent message could duplicate data
export const TCP_TIMEOUT_MS = 5000;

// Creating a payment waits on the ERP and then on Mercado Pago (5 s per try,
// one retry), so it needs more room than a plain call between services
export const PAYMENT_TCP_TIMEOUT_MS = 15_000;
