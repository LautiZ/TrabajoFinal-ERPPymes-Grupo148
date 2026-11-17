// Injection tokens for the TCP clients registered in the gateway
export const AUTH_SERVICE = 'AUTH_SERVICE';
export const ERP_SERVICE = 'ERP_SERVICE';
export const PAYMENTS_SERVICE = 'PAYMENTS_SERVICE';

// Message patterns shared by the gateway (sender) and each microservice (handler)
export const AUTH_PATTERNS = {
  COUNT_USERS: 'auth.users.count',
  CREATE_USER: 'auth.users.create',
  LOGIN: 'auth.login',
  VALIDATE_TOKEN: 'auth.token.validate',
  LOGOUT: 'auth.logout',
} as const;

export const ERP_PATTERNS = {
  COUNT_PRODUCTS: 'erp.products.count',
  LIST_PRODUCTS: 'erp.products.list',
  STOCK_SUMMARY: 'erp.products.stock-summary',
  GET_PRODUCT: 'erp.products.get',
  CREATE_PRODUCT: 'erp.products.create',
  UPDATE_PRODUCT: 'erp.products.update',
  DELETE_PRODUCT: 'erp.products.delete',
  ADJUST_STOCK: 'erp.products.adjust-stock',
  LIST_CATEGORIES: 'erp.categories.list',
  CREATE_CATEGORY: 'erp.categories.create',
} as const;

export const PAYMENTS_PATTERNS = {
  COUNT_PAYMENTS: 'payments.payments.count',
} as const;
