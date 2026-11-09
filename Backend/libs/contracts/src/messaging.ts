// Injection tokens for the TCP clients registered in the gateway
export const AUTH_SERVICE = 'AUTH_SERVICE';
export const ERP_SERVICE = 'ERP_SERVICE';
export const PAYMENTS_SERVICE = 'PAYMENTS_SERVICE';

// Message patterns shared by the gateway (sender) and each microservice (handler)
export const AUTH_PATTERNS = {
  COUNT_USERS: 'auth.users.count',
  LOGIN: 'auth.login',
  VALIDATE_TOKEN: 'auth.token.validate',
  LOGOUT: 'auth.logout',
} as const;

export const ERP_PATTERNS = {
  COUNT_PRODUCTS: 'erp.products.count',
} as const;

export const PAYMENTS_PATTERNS = {
  COUNT_PAYMENTS: 'payments.payments.count',
} as const;
