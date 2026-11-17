import { Payment, PaymentState } from '../models/payment.model';
import { Sale, SaleState } from '../models/sale.model';
import { resolvePaymentStatus, statusFromReturnParam } from './payment-status';

const sale = (currentState: SaleState): Sale => ({
  id: 's1',
  total: 100,
  currentState,
  createdAt: '',
});
const payment = (paymentState: PaymentState): Payment => ({
  id: 'pay1',
  saleId: 's1',
  paymentState,
  amount: 100,
});

describe('resolvePaymentStatus', () => {
  it('aprobado cuando el pago o la venta están pagos', () => {
    expect(resolvePaymentStatus(sale('Ordered'), payment('Paid'))).toBe('approved');
    expect(resolvePaymentStatus(sale('Paid'), null)).toBe('approved');
    expect(resolvePaymentStatus(sale('Dispatched'), null)).toBe('approved');
  });

  it('rechazado cuando el pago fue rechazado o la venta cancelada', () => {
    expect(resolvePaymentStatus(sale('Ordered'), payment('Rejected'))).toBe('rejected');
    expect(resolvePaymentStatus(sale('Cancelled'), null)).toBe('rejected');
  });

  it('pendiente en cualquier otro caso', () => {
    expect(resolvePaymentStatus(sale('Ordered'), payment('Pending'))).toBe('pending');
    expect(resolvePaymentStatus(sale('Ordered'), null)).toBe('pending');
    expect(resolvePaymentStatus(null, null)).toBe('pending');
  });
});

describe('statusFromReturnParam', () => {
  it('traduce el segmento de la URL de retorno', () => {
    expect(statusFromReturnParam('success')).toBe('approved');
    expect(statusFromReturnParam('failure')).toBe('rejected');
    expect(statusFromReturnParam('pending')).toBe('pending');
    expect(statusFromReturnParam('otra-cosa')).toBeNull();
    expect(statusFromReturnParam(null)).toBeNull();
  });
});
