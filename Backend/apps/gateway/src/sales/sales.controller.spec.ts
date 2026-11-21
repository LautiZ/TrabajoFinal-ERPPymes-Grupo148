import { ClientProxy } from '@nestjs/microservices';
import { of, throwError } from 'rxjs';
import { AUTH_PATTERNS, ERP_PATTERNS, PAYMENTS_PATTERNS } from '@app/contracts';
import type { AuthUser } from '@app/contracts';
import { SalesController } from './sales.controller';

const client = () => ({ send: jest.fn() });

const erpReceipt = {
  receiptNumber: '0001-00000123',
  saleId: 'sale-1',
  saleNumber: 113,
  issuedAt: '2026-11-18T23:37:07.000Z',
  sellerId: 'user-1',
  items: [],
  total: 9800,
};

describe('SalesController.receipt', () => {
  const erp = client();
  const auth = client();
  const payments = client();
  const controller = new SalesController(
    erp as unknown as ClientProxy,
    auth as unknown as ClientProxy,
    payments as unknown as ClientProxy,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    erp.send.mockReturnValue(of(erpReceipt));
    auth.send.mockReturnValue(of({ id: 'user-1', name: 'Ana', surname: null }));
    payments.send.mockReturnValue(
      of({ id: 'pay-1', state: 'Paid', mpPaymentId: 'PAY01', amount: 9800 }),
    );
  });

  it('composes the receipt from the ERP, the seller and the payment', async () => {
    await expect(controller.receipt('sale-1')).resolves.toEqual({
      receiptNumber: '0001-00000123',
      saleId: 'sale-1',
      saleNumber: 113,
      issuedAt: '2026-11-18T23:37:07.000Z',
      items: [],
      total: 9800,
      seller: { id: 'user-1', name: 'Ana', surname: null },
      payment: { id: 'pay-1', state: 'Paid', mpPaymentId: 'PAY01' },
    });
    expect(erp.send).toHaveBeenCalledWith(ERP_PATTERNS.GET_SALE_RECEIPT, {
      id: 'sale-1',
    });
    expect(auth.send).toHaveBeenCalledWith(AUTH_PATTERNS.GET_USER, {
      id: 'user-1',
    });
    expect(payments.send).toHaveBeenCalledWith(
      PAYMENTS_PATTERNS.GET_SALE_PAYMENT,
      { saleId: 'sale-1' },
    );
  });

  // An unpaid sale must fail before asking Auth and Payments
  it('propagates the ERP 409 for an unpaid sale', async () => {
    const notPaid = { status: 409, code: 'SALE_NOT_PAID', message: 'x' };
    erp.send.mockReturnValue(throwError(() => notPaid));

    await expect(controller.receipt('sale-1')).rejects.toBe(notPaid);
    expect(auth.send).not.toHaveBeenCalled();
    expect(payments.send).not.toHaveBeenCalled();
  });

  it('keeps the receipt when the seller or the payment is not found', async () => {
    auth.send.mockReturnValue(throwError(() => ({ status: 404 })));
    payments.send.mockReturnValue(throwError(() => ({ status: 404 })));

    await expect(controller.receipt('sale-1')).resolves.toMatchObject({
      seller: null,
      payment: null,
    });
  });

  it('fails when a service is down instead of hiding data', async () => {
    const down = { status: 503, message: 'unavailable' };
    payments.send.mockReturnValue(throwError(() => down));

    await expect(controller.receipt('sale-1')).rejects.toBe(down);
  });
});

describe('SalesController state changes', () => {
  const erp = client();
  const controller = new SalesController(
    erp as unknown as ClientProxy,
    client() as unknown as ClientProxy,
    client() as unknown as ClientProxy,
  );
  const user = { userId: 'user-1', role: 'Employee' } as AuthUser;

  beforeEach(() => {
    jest.clearAllMocks();
    erp.send.mockReturnValue(of({ id: 'sale-1' }));
  });

  it('cancel sends the sale id and the acting user to the ERP', async () => {
    await controller.cancel(user, 'sale-1');
    expect(erp.send).toHaveBeenCalledWith(ERP_PATTERNS.CANCEL_SALE_BY_USER, {
      id: 'sale-1',
      userId: 'user-1',
    });
  });

  it('dispatch sends the sale id and the acting user to the ERP', async () => {
    await controller.dispatch(user, 'sale-1');
    expect(erp.send).toHaveBeenCalledWith(ERP_PATTERNS.DISPATCH_SALE, {
      id: 'sale-1',
      userId: 'user-1',
    });
  });

  it('propagates the ERP 409 for a sale in the wrong state', async () => {
    const invalid = { status: 409, code: 'INVALID_SALE_STATE', message: 'x' };
    erp.send.mockReturnValue(throwError(() => invalid));

    await expect(controller.dispatch(user, 'sale-1')).rejects.toBe(invalid);
  });
});
