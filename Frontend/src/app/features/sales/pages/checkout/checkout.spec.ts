import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import type { Mock } from 'vitest';
import { NotificationService } from '../../../../shared/services/notification.service';
import { Payment } from '../../models/payment.model';
import { Sale } from '../../models/sale.model';
import { CART_STORAGE, CartService } from '../../services/cart.service';
import { PaymentsService } from '../../services/payments.service';
import { SalesService } from '../../services/sales.service';
import { StockCheckService } from '../../services/stock-check.service';
import { createMemoryStorage, createProduct } from '../../testing/factories';
import { Checkout } from './checkout';

const SALE: Sale = { id: 'sale-1', total: 3000, currentState: 'Ordered', createdAt: '' };
const MP_URL = 'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=1';
const PAYMENT: Payment = {
  id: 'pay-1',
  saleId: 'sale-1',
  amount: 3000,
  state: 'Pending',
  checkoutUrl: MP_URL,
  createdAt: '',
};

describe('Checkout', () => {
  let fixture: ComponentFixture<Checkout>;
  let cart: CartService;
  let sales: { createSale: Mock };
  let payments: {
    createPayment: Mock;
    redirectToCheckout: Mock;
    rememberPendingSale: Mock;
    clearPendingSale: Mock;
  };
  let stock: { verify: Mock; adjustToAvailable: Mock; withNames: Mock };
  let dialog: { open: Mock };
  let notify: { error: Mock; info: Mock; success: Mock };

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const submitForm = (): void => {
    (root().querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
  };
  const button = (): HTMLButtonElement =>
    root().querySelector('button[type=submit]') as HTMLButtonElement;

  beforeEach(async () => {
    sales = { createSale: vi.fn(() => of(SALE)) };
    payments = {
      createPayment: vi.fn(() => of(PAYMENT)),
      redirectToCheckout: vi.fn(),
      rememberPendingSale: vi.fn(),
      clearPendingSale: vi.fn(),
    };
    stock = {
      verify: vi.fn(() => of([])),
      adjustToAvailable: vi.fn(),
      withNames: vi.fn((c: unknown) => c),
    };
    dialog = { open: vi.fn(() => ({ afterClosed: () => of('review') })) };
    notify = { error: vi.fn(), info: vi.fn(), success: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [Checkout],
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        { provide: CART_STORAGE, useValue: createMemoryStorage() },
        { provide: SalesService, useValue: sales },
        { provide: PaymentsService, useValue: payments },
        { provide: StockCheckService, useValue: stock },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: notify },
      ],
    }).compileComponents();

    cart = TestBed.inject(CartService);
    cart.addItem(createProduct({ price: 1500, stock: 10 }), 2);
    fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
  });

  it('muestra el resumen de la orden con el total', () => {
    const text = root().textContent ?? '';
    expect(text).toContain('Yerba 1kg');
    expect(text).toContain('3,000.00');
  });

  it('no pide datos del cliente: el backend arma el cobro a partir de la venta', () => {
    expect(root().querySelector('input[type=email]')).toBeNull();
    expect(root().querySelector('input[type=text]')).toBeNull();
    expect(root().textContent).toContain('Mercado Pago');
  });

  it('el botón de cobro dice "Generar pago"', () => {
    expect(button().textContent?.trim()).toBe('Generar pago');
  });

  it('con el carrito vacío no permite confirmar ni llama al backend', () => {
    cart.clear();
    fixture.detectChanges();

    expect(root().querySelector('form')).toBeNull();
    (fixture.componentInstance as unknown as { submit: () => void }).submit();

    expect(sales.createSale).not.toHaveBeenCalled();
    expect(payments.createPayment).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('El carrito está vacío.');
  });

  it('crea la venta, genera el pago solo con el id de la venta y redirige a Mercado Pago', () => {
    submitForm();

    expect(stock.verify).toHaveBeenCalled();
    expect(sales.createSale).toHaveBeenCalledWith(cart.items());
    expect(payments.rememberPendingSale).toHaveBeenCalledWith('sale-1');
    expect(payments.createPayment).toHaveBeenCalledWith('sale-1');
    expect(payments.redirectToCheckout).toHaveBeenCalledWith(MP_URL);
  });

  it('si el pago llega sin checkoutUrl, lo informa y no deja la pantalla bloqueada', () => {
    payments.createPayment.mockReturnValue(of({ ...PAYMENT, checkoutUrl: null }));
    payments.redirectToCheckout.mockImplementation((url: string | null) => {
      if (!url) throw new Error('El servidor no devolvió la URL de pago.');
    });

    submitForm();
    fixture.detectChanges();

    expect(notify.error).toHaveBeenCalledWith('El servidor no devolvió la URL de pago.');
    expect(button().disabled).toBe(false);
  });

  it('si la URL de pago no es válida no deja la pantalla bloqueada', () => {
    payments.redirectToCheckout.mockImplementation(() => {
      throw new Error('La URL de pago recibida no pertenece a Mercado Pago.');
    });

    submitForm();
    fixture.detectChanges();

    expect(button().disabled).toBe(false);
    expect(notify.error).toHaveBeenCalledWith(
      'La URL de pago recibida no pertenece a Mercado Pago.',
    );
  });

  describe('stock', () => {
    it('si el stock bajó, avisa y no crea la venta', () => {
      stock.verify.mockReturnValue(
        of([{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }]),
      );

      submitForm();

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(sales.createSale).not.toHaveBeenCalled();
      expect(payments.redirectToCheckout).not.toHaveBeenCalled();
    });

    it('si el backend rechaza por stock insuficiente (409) muestra los ítems en conflicto', () => {
      sales.createSale.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 409,
              error: {
                statusCode: 409,
                message: 'Insufficient stock',
                code: 'INSUFFICIENT_STOCK',
                items: [{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }],
              },
            }),
        ),
      );

      submitForm();

      expect(dialog.open).toHaveBeenCalledTimes(1);
      expect(dialog.open.mock.calls[0][1].data.conflicts).toEqual([
        { productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 },
      ]);
      expect(payments.createPayment).not.toHaveBeenCalled();
    });

    it('al elegir ajustar, corrige el carrito al stock disponible', () => {
      dialog.open.mockReturnValue({ afterClosed: () => of('adjust') });
      stock.verify.mockReturnValue(
        of([{ productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 }]),
      );

      submitForm();

      expect(stock.adjustToAvailable).toHaveBeenCalledWith([
        { productId: 'p1', name: 'Yerba 1kg', requested: 2, available: 1 },
      ]);
    });
  });

  describe('errores al generar el pago', () => {
    it('si falla el pago, un reintento reutiliza la venta ya creada', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );

      submitForm();
      expect(payments.redirectToCheckout).not.toHaveBeenCalled();

      submitForm();

      expect(sales.createSale).toHaveBeenCalledTimes(1);
      expect(payments.createPayment).toHaveBeenCalledTimes(2);
      expect(payments.redirectToCheckout).toHaveBeenCalledWith(MP_URL);
    });

    it('si la venta ya no se puede cobrar (409 SALE_NOT_PAYABLE) lo explica y el reintento arma una venta nueva', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { code: 'SALE_NOT_PAYABLE' } }),
        ),
      );

      submitForm();

      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('ya no se puede cobrar'));
      expect(payments.clearPendingSale).toHaveBeenCalled();

      submitForm();

      expect(sales.createSale).toHaveBeenCalledTimes(2);
    });

    it('si Mercado Pago o el servicio no responden, informa que no se cobró nada', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 503 })),
      );

      submitForm();

      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('No se cobró nada'));
      expect(button().disabled).toBe(false);
    });

    it('si Mercado Pago rechaza la solicitud (502) lo informa', () => {
      payments.createPayment.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 502 })),
      );

      submitForm();

      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('Mercado Pago rechazó'));
    });
  });
});
